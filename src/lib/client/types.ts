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
}

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
}

export interface BrowserState {
	open: boolean;
	/** Quem dirige o browser agora. */
	controller: 'agent' | 'user' | 'idle';
	applicationId: string | null;
	url: string | null;
	title: string | null;
	viewport: { width: number; height: number };
	accounts: { linkedin: boolean; glassdoor: boolean };
}

export interface BrowserFrame {
	/** JPEG em base64. */
	jpeg: string;
	width: number;
	height: number;
}

/** Coordenadas em pixels CSS do viewport remoto (state.viewport). */
export type BrowserInput =
	| { type: 'tap'; x: number; y: number }
	| { type: 'scroll'; deltaY: number; x?: number; y?: number }
	| { type: 'type'; text: string }
	| { type: 'key'; key: string }
	| { type: 'back' }
	| { type: 'reload' };
