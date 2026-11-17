export type JobSource = 'linkedin' | 'glassdoor';

export interface Job {
	id: string;
	title: string;
	company: string;
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

export interface ApplicationEvent {
	at: string;
	message: string;
	status?: ApplicationStatus;
}

export interface Application {
	id: string;
	job: Job;
	status: ApplicationStatus;
	tailoredPdfUrl: string | null;
	lastMessage: string | null;
	updatedAt: string;
	events?: ApplicationEvent[];
}

export interface Preferences {
	terms: string[];
	locations: string[];
	remote: boolean;
	area: string;
	seniority: string;
	updatedAt?: string | null;
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
