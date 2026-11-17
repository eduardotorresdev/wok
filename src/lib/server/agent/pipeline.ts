import { eq } from 'drizzle-orm';
import {
	getRow,
	listSteps,
	logStep,
	setLastUrl,
	setStatus,
	update
} from '../applications/store.ts';
import { enqueue, setRunner } from '../applications/queue.ts';
import {
	acquireForAgent,
	releaseFromAgent,
	setPausedTabSource,
	watchBarrier,
	type AgentBrowser
} from '../browser/service.ts';
import { db, schema, sqlite } from '../db/index.ts';
import { compileLatex, userDir } from '../latex.ts';
import { getPreferences } from '../preferences.ts';
import { config } from '../env.ts';
import { getProfile, listAnswers, missingProfileQuestion } from '../profile.ts';
import { compileResume, getResume, getResumeRow } from '../resume.ts';
import { applyToJob, type ApplyOutcome } from './applier.ts';
import { describeLlmError, hasLlm } from './llm.ts';
import { getAreaStrategy, researchArea } from './researcher.ts';
import { tailorResume } from './tailor.ts';

/** Tailors the résumé (once) and then applies. Every exit leaves an explicit status. */
async function runApplication(applicationId: string) {
	const app = getRow(applicationId);
	if (!app || app.status !== 'queued') return;
	const userId = app.userId;
	const job = db().select().from(schema.job).where(eq(schema.job.id, app.jobId)).get();
	// The user table belongs to Better Auth, so it is read without the drizzle schema.
	const user = sqlite().prepare('select email from user where id = ?').get(userId) as
		{ email: string } | undefined;
	if (!job)
		return void setStatus(applicationId, 'failed', 'A vaga desta inscrição não existe mais.');
	if (!hasLlm()) {
		return void setStatus(
			applicationId,
			'failed',
			'ANTHROPIC_API_KEY não configurada no servidor.'
		);
	}
	const resume = getResumeRow(userId);
	if (!resume?.latex.trim()) {
		return void setStatus(
			applicationId,
			'failed',
			'Envie seu currículo em LaTeX antes de se candidatar; depois toque em tentar de novo.'
		);
	}

	const prefs = getPreferences(userId);
	const profile = getProfile(userId);
	const area = prefs.area || prefs.terms[0] || '';

	// ------------------------------------------------------------ before any form
	// Every form asks for name and phone; asking now is cheaper than stopping mid-form.
	const missing = missingProfileQuestion(profile);
	if (missing) {
		return void setStatus(
			applicationId,
			'needs_user',
			`Antes de começar, preciso de um dado seu: ${missing}`,
			{
				needsKind: 'question',
				pendingQuestion: missing
			}
		);
	}
	// A base résumé that does not compile cannot be tailored; the person fixes it and resumes.
	if (!app.tailoredPdfPath && getResume(userId).pages === null) {
		logStep(applicationId, 'tailor', 'Conferindo se o seu currículo base compila.');
		const base = await compileResume(userId);
		if (!base?.ok) {
			return void setStatus(
				applicationId,
				'needs_user',
				'Seu currículo base não compila, então não consigo adaptá-lo. Corrija o LaTeX na tela Currículo e toque em retomar.',
				{ needsKind: 'resume' }
			);
		}
	}
	const workDir = userDir(userId, 'applications', applicationId);

	// ------------------------------------------------------------ tailoring
	let pdfPath = app.tailoredPdfPath;
	let tailoredLatex = app.tailoredLatex;
	if (!pdfPath || !tailoredLatex) {
		setStatus(applicationId, 'tailoring', 'Adaptando o currículo para esta vaga.');
		let strategy = area ? getAreaStrategy(area) : null;
		if (area && !strategy) {
			logStep(applicationId, 'research', `Pesquisando o que funciona em candidaturas de ${area}.`);
			strategy = await researchArea({ area, seniority: prefs.seniority, country: profile.country });
		}
		try {
			const result = await tailorResume({
				baseLatex: resume.latex,
				job: {
					title: job.title,
					company: job.company,
					location: job.location,
					description: job.description ?? ''
				},
				area,
				areaStrategy: strategy,
				confidential: profile.confidential,
				workDir,
				onProgress: (message) => logStep(applicationId, 'tailor', message)
			});
			pdfPath = result.pdfPath;
			tailoredLatex = result.latex;
			update(applicationId, { tailoredLatex, tailoredPdfPath: pdfPath });
			if (result.note) logStep(applicationId, 'tailor_note', result.note);
		} catch (err) {
			// Nothing is sent without a one-page résumé; the person can adjust the base and resume.
			return void setStatus(
				applicationId,
				'needs_user',
				`Não consegui adaptar o currículo para 1 página: ${describeLlmError(err)} Ajuste o currículo base se quiser e toque em retomar.`,
				{ needsKind: 'resume' }
			);
		}
	}

	// ------------------------------------------------------------ applying
	const history = listSteps(applicationId)
		.filter((s) => ['action', 'status', 'user_answer'].includes(s.kind))
		.slice(-25)
		.map((s) => s.message);
	const hadAttempt = listSteps(applicationId).some((s) => s.kind === 'action');
	const dryRun = config.applyDryRunFor(user?.email ?? '');
	setStatus(
		applicationId,
		'applying',
		dryRun
			? 'Preenchendo a candidatura no site da vaga (modo de teste: nada será enviado).'
			: 'Preenchendo a candidatura no site da vaga.'
	);
	const strategy = area ? getAreaStrategy(area) : null;
	// The text the form-filler reads is the one actually inside the PDF being uploaded.
	const compiled = await compileLatex(tailoredLatex, `${workDir}/text`).catch(() => null);

	let outcome: ApplyOutcome;
	let browser: AgentBrowser | undefined;
	try {
		browser = await acquireForAgent(userId, applicationId);
		const agentBrowser = browser;
		logStep(applicationId, 'control', 'O agente assumiu o browser.', { controller: 'agent' });
		outcome = await applyToJob({
			browser: agentBrowser,
			job: {
				title: job.title,
				company: job.company,
				location: job.location,
				url: job.applyUrl || job.url,
				description: job.description ?? ''
			},
			source: job.source,
			resumePdfPath: pdfPath,
			resumeText: compiled?.text ?? '',
			email: user?.email ?? '',
			profile,
			answers: listAnswers(userId),
			area,
			areaStrategy: strategy,
			history: hadAttempt ? history : [],
			dryRun,
			onStep: (kind, message, data) => {
				setLastUrl(applicationId, agentBrowser.url());
				logStep(applicationId, kind, message, data);
			}
		});
	} catch (err) {
		outcome = { type: 'failed', message: `Erro durante a candidatura: ${describeLlmError(err)}` };
	}

	// Where it stopped is what lets the tab be rebuilt if the server restarts during the pause.
	if (browser) setLastUrl(applicationId, browser.url());

	if (outcome.type !== 'submitted' && outcome.type !== 'failed') {
		// The tab stays exactly as it is for the person; the queue moves on in another tab.
		await releaseFromAgent(userId, applicationId, 'user');
		logStep(applicationId, 'control', 'O browser está com você.', { controller: 'user' });
	} else {
		await releaseFromAgent(userId, applicationId, 'close');
		logStep(applicationId, 'control', 'O agente liberou o browser.', { controller: 'idle' });
	}

	switch (outcome.type) {
		case 'submitted':
			return void setStatus(applicationId, 'submitted', outcome.message);
		case 'ask_user':
			return void setStatus(applicationId, 'needs_user', outcome.message, {
				needsKind: 'question',
				pendingQuestion: outcome.question
			});
		case 'ready':
			return void setStatus(
				applicationId,
				'needs_user',
				`Pronto para enviar (modo de teste, nada foi enviado). ${outcome.message}`,
				{ needsKind: 'browser' }
			);
		case 'needs_browser':
			setStatus(applicationId, 'needs_user', outcome.message, { needsKind: 'browser' });
			return void resumeWhenBarrierClears(userId, applicationId);
		case 'failed':
			return void setStatus(applicationId, 'failed', outcome.message);
	}
}

const MAX_AUTO_RESUMES = 3;

/**
 * When the pause is a login or verification screen, notice the person getting
 * past it and continue without waiting for the "continue" button. Capped, so a
 * site that keeps bouncing back to the barrier cannot loop the agent forever.
 */
function resumeWhenBarrierClears(userId: string, applicationId: string) {
	const used = listSteps(applicationId).filter((s) => s.kind === 'auto_resume').length;
	if (used >= MAX_AUTO_RESUMES) return;
	watchBarrier(userId, applicationId, () => {
		if (getRow(applicationId)?.status !== 'needs_user') return;
		logStep(
			applicationId,
			'auto_resume',
			'Vi que você passou pela verificação; continuando sozinho.'
		);
		setStatus(applicationId, 'queued', 'Retomando a inscrição.');
		enqueue(userId, applicationId);
	});
}

/** A paused application's tab can be rebuilt at the page where it stopped (or at the job). */
function pausedTab(userId: string, applicationId: string) {
	const app = getRow(applicationId);
	if (!app || app.userId !== userId) return null;
	// Only a pause that asks the person to act in the browser needs its tab back.
	if (app.status !== 'needs_user' || app.needsKind !== 'browser') return null;
	const job = db().select().from(schema.job).where(eq(schema.job.id, app.jobId)).get();
	const url = app.lastUrl || job?.applyUrl || job?.url;
	return url ? { url } : null;
}

export function registerPipeline() {
	setRunner(runApplication);
	// After a restart nothing is watching paused applications; the watch comes back
	// together with the tab, when the person opens the viewer, not before.
	setPausedTabSource(pausedTab, (userId, applicationId) => {
		if (getRow(applicationId)?.needsKind === 'browser') {
			resumeWhenBarrierClears(userId, applicationId);
		}
	});
}
