// Fixture local, só em dev, com o mesmo formato do contrato de API.
// Entra em cena quando a rota real ainda responde 404, ou com ?mock na URL (ver api.ts).
// ?estado=vazio|erro|carregando força os estados da home.
import { ApiError } from './api.ts';
import type {
	Application,
	ApplicationStatus,
	Job,
	Preferences,
	Resume,
	SearchRun,
	Step,
	SwipeDirection
} from './types.ts';

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

export const JOBS: Job[] = [
	{
		id: 'job-1',
		title: 'Engenheira de Software Sênior, Plataforma',
		company: 'Nubank',
		location: 'São Paulo, SP · Híbrido',
		source: 'linkedin',
		url: 'https://www.linkedin.com/jobs/view/1',
		salary: 'R$ 18–24 mil',
		postedAt: ago(0.4),
		summary:
			'Time de plataforma que mantém os serviços de pagamentos em Clojure e Kotlin. Você vai desenhar APIs internas, cuidar de observabilidade e apoiar squads de produto em decisões de arquitetura.',
		matchScore: 92,
		matchReasons: [
			'6 anos com sistemas distribuídos, como a vaga pede',
			'Experiência com Kafka e Kubernetes no último emprego',
			'Já liderou migração de monolito para serviços'
		]
	},
	{
		id: 'job-2',
		title: 'Tech Lead Front-End',
		company: 'iFood',
		location: 'Remoto · Brasil',
		source: 'glassdoor',
		url: 'https://www.glassdoor.com.br/job/2',
		salary: 'R$ 20–26 mil',
		postedAt: ago(1),
		summary:
			'Liderar o front do app de parceiros: React, TypeScript e design system próprio. Metade do tempo em código, metade em mentoria e alinhamento com produto.',
		matchScore: 87,
		matchReasons: [
			'TypeScript e React em produção desde 2019',
			'Manteve um design system com mais de 40 componentes',
			'Vaga remota, como você prefere'
		]
	},
	{
		id: 'job-3',
		title: 'Staff Engineer, Dados',
		company: 'Mercado Livre',
		location: 'Florianópolis, SC',
		source: 'linkedin',
		url: 'https://www.linkedin.com/jobs/view/3',
		salary: null,
		postedAt: ago(2),
		summary:
			'Arquitetura do pipeline de eventos de logística: bilhões de mensagens por dia, Flink e BigQuery. Atuação transversal com times de ciência de dados.',
		matchScore: 78,
		matchReasons: [
			'Pipelines de streaming no currículo',
			'Falta experiência direta com Flink',
			'Senioridade compatível'
		]
	},
	{
		id: 'job-4',
		title: 'Desenvolvedora Full Stack Pleno',
		company: 'Loft',
		location: 'Remoto · Brasil',
		source: 'glassdoor',
		url: 'https://www.glassdoor.com.br/job/4',
		salary: 'R$ 11–14 mil',
		postedAt: ago(3),
		summary:
			'Squad de crédito imobiliário. Node, Postgres e SvelteKit no painel interno. Entregas semanais e contato direto com o time de operações.',
		matchScore: 71,
		matchReasons: ['SvelteKit e Node no dia a dia', 'A vaga é pleno; seu perfil é sênior']
	},
	{
		id: 'job-5',
		title: 'Engenheiro de Confiabilidade (SRE)',
		company: 'Stone',
		location: 'Rio de Janeiro, RJ · Híbrido',
		source: 'linkedin',
		url: 'https://www.linkedin.com/jobs/view/5',
		salary: 'R$ 16–21 mil',
		postedAt: ago(4),
		summary:
			'Plantão compartilhado, automação de infraestrutura com Terraform e metas de disponibilidade para a adquirência. Go e Elixir no stack.',
		matchScore: 66,
		matchReasons: ['Terraform e Kubernetes no currículo', 'Pouca vivência com Elixir']
	},
	{
		id: 'job-6',
		title: 'Engineering Manager, Checkout',
		company: 'VTEX',
		location: 'Remoto · América Latina',
		source: 'linkedin',
		url: 'https://www.linkedin.com/jobs/view/6',
		salary: 'US$ 6–8 mil',
		postedAt: ago(6),
		summary:
			'Gestão de um time de 8 pessoas responsável pelo checkout. Planejamento trimestral, contratação e saúde técnica do produto.',
		matchScore: 58,
		matchReasons: ['Liderou times de até 5 pessoas', 'Sem experiência formal como gestora']
	}
];

interface Store {
	resume: Resume;
	preferences: Preferences;
	swiped: Record<string, SwipeDirection>;
	apps: { id: string; jobId: string; createdAt: number; forceSubmit?: boolean }[];
	collectingUntil: number;
}

const KEY = 'wok:mock:v1';

function load(): Store {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return JSON.parse(raw) as Store;
	} catch {
		// armazenamento indisponível: segue em memória
	}
	return {
		resume: { latex: '', pages: null, pdfUrl: null, updatedAt: null },
		preferences: {
			terms: [],
			locations: [],
			remote: false,
			area: '',
			seniority: '',
			updatedAt: null
		},
		swiped: {},
		apps: [],
		collectingUntil: 0
	};
}

let store: Store | undefined;
const db = () => (store ??= load());
function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(db()));
	} catch {
		// idem
	}
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STEPS: { after: number; status: ApplicationStatus; message: string }[] = [
	{ after: 0, status: 'queued', message: 'Na fila do agente' },
	{ after: 3, status: 'tailoring', message: 'Lendo a descrição da vaga' },
	{ after: 6, status: 'tailoring', message: 'Adaptando o currículo para a vaga' },
	{ after: 10, status: 'tailoring', message: 'Currículo adaptado compilado em 1 página' },
	{ after: 12, status: 'applying', message: 'Abrindo a página da vaga' },
	{ after: 16, status: 'applying', message: 'Preenchendo o formulário de candidatura' }
];

function finalStep(index: number, job: Job) {
	if (job.source === 'linkedin' && index % 2 === 0) {
		return {
			after: 20,
			status: 'needs_user' as const,
			message: 'O LinkedIn pediu login. Entre pelo Browser para o agente continuar.'
		};
	}
	if (index % 4 === 3) {
		return {
			after: 20,
			status: 'failed' as const,
			message: 'A vaga foi encerrada antes do envio.'
		};
	}
	return { after: 20, status: 'submitted' as const, message: 'Candidatura enviada' };
}

function toApplication(entry: Store['apps'][number], index: number): Application | null {
	const job = JOBS.find((j) => j.id === entry.jobId);
	if (!job) return null;
	const elapsed = (Date.now() - entry.createdAt) / 1000;
	const all = [
		...STEPS,
		entry.forceSubmit
			? { after: 20, status: 'submitted' as const, message: 'Candidatura enviada' }
			: finalStep(index, job)
	];
	const visible = all.filter((s) => s.after <= elapsed);
	const last = visible[visible.length - 1];
	const steps: Step[] = visible.map((s, i) => ({
		id: i + 1,
		kind: s.status,
		message: s.message,
		data: null,
		createdAt: new Date(entry.createdAt + s.after * 1000).toISOString()
	}));
	const question = last.status === 'needs_user' && index % 4 === 2;
	return {
		id: entry.id,
		job,
		status: last.status,
		tailoredPdfUrl: null,
		lastMessage: question
			? 'O formulário tem uma pergunta que só você sabe responder.'
			: last.message,
		needsKind: last.status === 'needs_user' ? (question ? 'question' : 'browser') : null,
		pendingQuestion: question ? 'Você tem disponibilidade para viajar até 20% do tempo?' : null,
		createdAt: new Date(entry.createdAt).toISOString(),
		updatedAt: steps[steps.length - 1].createdAt,
		steps
	};
}

function applications() {
	return db()
		.apps.map((entry, i) => toApplication(entry, i))
		.filter((a): a is Application => a !== null)
		.reverse();
}

function run(s: Store): SearchRun {
	const running = Date.now() < s.collectingUntil;
	return {
		id: 'run-mock',
		status: running ? 'running' : 'done',
		message: running ? 'Lendo vagas no LinkedIn' : null,
		found: running ? 0 : JOBS.length,
		startedAt: new Date(s.collectingUntil - 4000).toISOString(),
		finishedAt: running ? null : new Date(s.collectingUntil).toISOString()
	};
}

let browserOpen = false;

function forced() {
	return new URLSearchParams(location.search).get('estado');
}

export async function mock(method: string, path: string, body: unknown): Promise<unknown> {
	await wait(250 + Math.random() * 250);
	const s = db();
	const route = `${method} ${path.split('?')[0]}`;
	const input = (body ?? {}) as Record<string, unknown>;

	if (route === 'GET /api/jobs/feed') {
		const estado = forced();
		if (estado === 'erro') throw new ApiError(500, 'mock', 'Não deu para carregar as vagas.');
		if (estado === 'carregando') await wait(60_000);
		if (estado === 'vazio' || Date.now() < s.collectingUntil) return [];
		return JOBS.filter((j) => !s.swiped[j.id]);
	}
	if (route === 'POST /api/jobs/search') {
		for (const [id, direction] of Object.entries(s.swiped)) {
			if (direction === 'skip') delete s.swiped[id];
		}
		s.collectingUntil = Date.now() + 4000;
		save();
		return { run: run(s) };
	}
	if (route === 'GET /api/jobs/search') return { run: s.collectingUntil ? run(s) : null };
	const swipe = route.match(/^POST \/api\/jobs\/([^/]+)\/swipe$/);
	if (swipe) {
		const id = decodeURIComponent(swipe[1]);
		const direction = input.direction as SwipeDirection;
		s.swiped[id] = direction;
		if (direction === 'apply') {
			s.apps.push({ id: `app-${Date.now()}`, jobId: id, createdAt: Date.now() });
		}
		save();
		return { ok: true };
	}
	if (route === 'GET /api/applications') return applications();
	const app = route.match(/^GET \/api\/applications\/([^/]+)$/);
	if (app) {
		const found = applications().find((a) => a.id === decodeURIComponent(app[1]));
		if (!found) throw new ApiError(404, 'not_found', 'Candidatura não encontrada.');
		return found;
	}
	const resume = route.match(/^POST \/api\/applications\/([^/]+)\/(answer|resume)$/);
	if (resume) {
		const entry = s.apps.find((a) => a.id === decodeURIComponent(resume[1]));
		if (!entry) throw new ApiError(404, 'application_not_found', 'Inscrição não encontrada.');
		// Volta para o trecho "inscrevendo" e termina como enviada.
		entry.createdAt = Date.now() - 12_000;
		s.apps = s.apps.map((a) => (a === entry ? { ...a, forceSubmit: true } : a));
		save();
		return applications().find((a) => a.id === entry.id);
	}
	if (route.startsWith('GET /api/browser') || route.startsWith('POST /api/browser')) {
		if (route === 'POST /api/browser/open') browserOpen = true;
		if (route === 'POST /api/browser/close') browserOpen = false;
		return {
			open: browserOpen,
			controller: browserOpen ? 'user' : 'idle',
			applicationId: null,
			url: browserOpen ? ((input.url as string) ?? 'https://www.linkedin.com/login') : null,
			title: null,
			viewport: { width: 412, height: 839 },
			accounts: { linkedin: false, glassdoor: false }
		};
	}

	throw new ApiError(404, 'mock_missing', `Sem fixture para ${route}`);
}
