export type JobSource = 'linkedin' | 'glassdoor';

export interface Job {
	id: string;
	title: string;
	company: string;
	/** Logo da empresa, quando a coleta trouxer. */
	companyLogo?: string | null;
	location: string | null;
	source: JobSource;
	url: string;
	salary: string | null;
	postedAt: string | null;
	summary: string | null;
	matchScore: number | null;
	matchReasons: string[];
	/** Por onde a inscrição será feita. Ausente em servidores antigos. */
	applyVia?: 'company' | 'linkedin' | 'glassdoor' | null;
	/** Como a vaga recebe candidaturas no site de origem. */
	applyType?: 'easy' | 'external' | null;
	/** Falso quando falta conectar a conta do provedor da vaga. Ausente em servidores antigos. */
	canApply?: boolean;
	blockedBy?: Provider | null;
}

/** Sites em que a pessoa conecta a própria conta. */
export type Provider = 'linkedin' | 'glassdoor';

export interface SearchRun {
	id: string;
	status: 'running' | 'done' | 'failed';
	message: string | null;
	found: number;
	startedAt: string;
	finishedAt: string | null;
}

export type SwipeDirection = 'apply' | 'skip';

export type ApplicationStatus =
	'queued' | 'tailoring' | 'applying' | 'needs_user' | 'submitted' | 'failed';

export interface Step {
	id: number;
	kind: string;
	message: string;
	data: Record<string, unknown> | null;
	createdAt: string;
}

export interface Application {
	id: string;
	job: Job;
	status: ApplicationStatus;
	tailoredPdfUrl: string | null;
	lastMessage: string | null;
	/** Em needs_user: 'question' (responder) ou 'browser' (agir no browser e continuar). */
	needsKind: 'question' | 'browser' | 'resume' | null;
	pendingQuestion: string | null;
	createdAt: string;
	updatedAt: string;
	steps?: Step[];
}

export interface Preferences {
	terms: string[];
	locations: string[];
	remote: boolean;
	area: string;
	seniority: string;
	updatedAt?: string | null;
}

export interface SalaryRange {
	min: number | null;
	max: number | null;
}

export interface Profile {
	fullName: string;
	phone: string;
	city: string;
	country: string;
	linkedinUrl: string;
	portfolioLinks: string[];
	/** Valores mensais. */
	salary: {
		currency: string;
		preferredRegime: 'clt' | 'pj' | 'outro' | '';
		clt: SalaryRange;
		pj: SalaryRange;
	};
	availability: string;
	workAuthorization: { country: string; authorized: boolean; note: string }[];
	workModel: 'remote' | 'hybrid' | 'onsite' | 'any';
	willingToRelocate: boolean;
	languages: { language: string; level: string }[];
	professionalRegistration: { number: string; state: string; status: string };
	certifications: { name: string; validUntil: string }[];
	shifts: string[];
	confidential: string[];
	/** Email quando uma inscrição precisa da pessoa. Ausente em servidores antigos. */
	notifyEmail?: boolean;
	updatedAt?: string | null;
}

export const emptyProfile = (): Profile => ({
	fullName: '',
	phone: '',
	city: '',
	country: '',
	linkedinUrl: '',
	portfolioLinks: [],
	salary: {
		currency: 'BRL',
		preferredRegime: '',
		clt: { min: null, max: null },
		pj: { min: null, max: null }
	},
	availability: '',
	workAuthorization: [],
	workModel: 'any',
	willingToRelocate: false,
	languages: [],
	professionalRegistration: { number: '', state: '', status: '' },
	certifications: [],
	shifts: [],
	confidential: [],
	updatedAt: null
});

export const emptyPreferences = (): Preferences => ({
	terms: [],
	locations: [],
	remote: false,
	area: '',
	seniority: '',
	updatedAt: null
});

/** Pergunta que o servidor sugere para completar o perfil profissional. */
export interface ProfileQuestion {
	id: string;
	text: string;
	/** Por que a resposta ajuda, quando o servidor disser. */
	hint?: string | null;
}

/** O perfil profissional: um markdown só, a fonte de fatos do agente. */
export interface ProfileDoc {
	markdown: string;
	updatedAt: string | null;
	questions: ProfileQuestion[];
}

export interface SavedAnswer {
	id: string;
	question: string;
	answer: string;
	updatedAt: string;
}

export interface Resume {
	latex: string;
	pages: number | null;
	pdfUrl: string | null;
	updatedAt: string | null;
}

export interface CompileResult {
	ok: boolean;
	pages: number;
	pdfUrl: string | null;
	log: string;
	/** Mensagens de erro já inteiras, quando o servidor as extrai. */
	errors?: string[] | null;
	/** Uma frase em português dizendo a causa provável e o que fazer. */
	explanation?: string | null;
}

export interface BrowserState {
	open: boolean;
	/** Quem dirige o browser agora. */
	controller: 'agent' | 'user' | 'idle';
	applicationId: string | null;
	url: string | null;
	title: string | null;
	viewport: { width: number; height: number };
	/** A página ainda está abrindo em segundo plano; toques só valem depois. */
	loading?: boolean;
	/** A navegação falhou: frase pronta para mostrar. */
	loadError?: string | null;
	/** Sobe a cada navegação da aba; um frame com nav menor ainda é da página anterior. */
	nav?: number;
	/** O Glassdoor barra o nosso browser: lá a pessoa se inscreve por conta própria. */
	glassdoorManual?: boolean;
	accounts: { linkedin: boolean; glassdoor: boolean };
}

export interface BrowserFrame {
	/** JPEG em base64. */
	jpeg: string;
	width: number;
	height: number;
	url?: string;
	/** Navegação da aba a que esta imagem pertence (compare com state.nav). */
	nav?: number;
}

/** Coordenadas em pixels CSS do viewport remoto (state.viewport). */
export type BrowserInput =
	| { type: 'tap'; x: number; y: number }
	| { type: 'scroll'; deltaY: number; x?: number; y?: number }
	| { type: 'type'; text: string }
	| { type: 'key'; key: string }
	| { type: 'back' }
	| { type: 'reload' };
