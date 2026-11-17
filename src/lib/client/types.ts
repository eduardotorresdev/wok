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
	needsKind: 'question' | 'browser' | null;
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

export interface Profile {
	fullName: string;
	phone: string;
	city: string;
	country: string;
	linkedinUrl: string;
	portfolioUrl: string;
	salary: {
		min: number | null;
		max: number | null;
		currency: string;
		regime: 'clt' | 'pj' | 'outro' | '';
	};
	availability: string;
	workAuthorization: { country: string; authorized: boolean; note: string }[];
	workModel: 'remote' | 'hybrid' | 'onsite' | 'any';
	willingToRelocate: boolean;
	languages: { language: string; level: string }[];
	updatedAt?: string | null;
}

export const EMPTY_PROFILE: Profile = {
	fullName: '',
	phone: '',
	city: '',
	country: '',
	linkedinUrl: '',
	portfolioUrl: '',
	salary: { min: null, max: null, currency: 'BRL', regime: '' },
	availability: '',
	workAuthorization: [],
	workModel: 'any',
	willingToRelocate: false,
	languages: [],
	updatedAt: null
};

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
	url: string | null;
	title?: string | null;
}

export type BrowserInput =
	| { type: 'tap'; x: number; y: number }
	| { type: 'scroll'; x: number; y: number; deltaX?: number; deltaY: number }
	| { type: 'type'; text: string }
	| { type: 'key'; key: string }
	| { type: 'back' };
