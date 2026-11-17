import { eq } from 'drizzle-orm';
import { getRow, listSteps, logStep, setStatus, update } from '../applications/store.ts';
import { setRunner } from '../applications/queue.ts';
import { acquireForAgent, releaseFromAgent } from '../browser/service.ts';
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
	try {
		const browser = await acquireForAgent(userId, applicationId);
		logStep(applicationId, 'control', 'O agente assumiu o browser.', { controller: 'agent' });
		outcome = await applyToJob({
			browser,
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
			onStep: (kind, message, data) => logStep(applicationId, kind, message, data)
		});
	} catch (err) {
		outcome = { type: 'failed', message: `Erro durante a candidatura: ${describeLlmError(err)}` };
	}

	if (outcome.type !== 'submitted' && outcome.type !== 'failed') {
		// The page stays open and the person can act on it right away.
		await releaseFromAgent(userId, 'user', true);
		logStep(applicationId, 'control', 'O browser está com você.', { controller: 'user' });
	} else {
		await releaseFromAgent(userId, 'idle');
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
			return void setStatus(applicationId, 'needs_user', outcome.message, { needsKind: 'browser' });
		case 'failed':
			return void setStatus(applicationId, 'failed', outcome.message);
	}
}

export function registerPipeline() {
	setRunner(runApplication);
}
