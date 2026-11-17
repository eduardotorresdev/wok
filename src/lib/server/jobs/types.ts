import type { JobSource } from '../db/schema.ts';

/** A posting as collected, before it is stored and scored. */
export interface CollectedJob {
	source: JobSource;
	externalId: string;
	title: string;
	company: string;
	location: string | null;
	url: string;
	applyUrl: string | null;
	salary: string | null;
	postedAt: string | null;
	description: string;
}

export interface SearchQuery {
	keywords: string;
	location: string;
}
