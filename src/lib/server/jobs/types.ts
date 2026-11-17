import type { JobSource } from '../db/schema.ts';

/** A posting as collected, before it is stored and scored. */
export interface CollectedJob {
	source: JobSource;
	externalId: string;
	title: string;
	company: string;
	companyLogo: string | null;
	location: string | null;
	url: string;
	applyUrl: string | null;
	/** 'easy': the form is on the job board itself; 'external': its button leads to the company's site. */
	applyType: 'easy' | 'external' | null;
	salary: string | null;
	postedAt: string | null;
	description: string;
}

export interface SearchQuery {
	keywords: string;
	location: string;
}
