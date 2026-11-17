import { ApifyClient } from 'apify-client';
import { config } from '../env.ts';
import type { CollectedJob, SearchQuery } from './types.ts';

// Both actors charge per dataset item, so `limit` is also the cost ceiling.
const LINKEDIN_ACTOR = 'valig/linkedin-jobs-scraper';
const GLASSDOOR_ACTOR = 'valig/glassdoor-jobs-scraper';
const WAIT_SECS = 180;

export function hasApify() {
	return !!config.apifyToken;
}

function client() {
	return new ApifyClient({ token: config.apifyToken });
}

async function runActor(actor: string, input: Record<string, unknown>, limit: number) {
	const run = await client().actor(actor).call(input, { waitSecs: WAIT_SECS, log: null });
	if (run.status !== 'SUCCEEDED') {
		throw new Error(`${actor} terminou com status ${run.status}`);
	}
	const { items } = await client().dataset(run.defaultDatasetId).listItems({ limit });
	return items as Record<string, unknown>[];
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function htmlToText(html: string) {
	return html
		.replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
		.replace(/<li[^>]*>/gi, '• ')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&reg;/g, '®')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export async function searchLinkedIn(query: SearchQuery, limit: number): Promise<CollectedJob[]> {
	const items = await runActor(
		LINKEDIN_ACTOR,
		{ keywords: query.keywords, location: query.location, datePosted: 'r2592000', limit },
		limit
	);
	const jobs: CollectedJob[] = [];
	for (const it of items) {
		const id = str(it.id) ?? (typeof it.id === 'number' ? String(it.id) : null);
		const title = str(it.title);
		const url = str(it.url);
		if (!id || !title || !url) continue;
		jobs.push({
			source: 'linkedin',
			externalId: id,
			title,
			company: str(it.companyName) ?? 'Empresa não informada',
			companyLogo: str(it.companyLogo) ?? str(it.companyLogoUrl) ?? str(it.logoUrl),
			location: str(it.location),
			url,
			applyUrl: str(it.applyUrl),
			salary: str(it.salary),
			postedAt: str(it.postedDate),
			description: str(it.description) ?? htmlToText(str(it.descriptionHtml) ?? '')
		});
	}
	return jobs;
}

function glassdoorSalary(pay: unknown): string | null {
	if (!pay || typeof pay !== 'object') return null;
	const p = pay as { currency?: string; period?: string; min?: number; max?: number };
	if (p.min == null && p.max == null) return null;
	const fmt = (n: number) => n.toLocaleString('pt-BR');
	const range =
		p.min != null && p.max != null && p.min !== p.max
			? `${fmt(p.min)}–${fmt(p.max)}`
			: fmt((p.min ?? p.max)!);
	const period = p.period ? ` / ${p.period.toLowerCase()}` : '';
	return `${p.currency ?? ''} ${range}${period}`.trim();
}

export async function searchGlassdoor(query: SearchQuery, limit: number): Promise<CollectedJob[]> {
	const items = await runActor(
		GLASSDOOR_ACTOR,
		{ keywords: query.keywords, location: query.location, daysOld: 30, limit },
		limit
	);
	const jobs: CollectedJob[] = [];
	for (const it of items) {
		const id = typeof it.id === 'number' || typeof it.id === 'string' ? String(it.id) : null;
		const title = str(it.title);
		const url = str(it.seoUrl) ?? str(it.url);
		if (!id || !title || !url) continue;
		const employer = it.employer as { name?: string; logoUrl?: string } | undefined;
		const location = it.location as { name?: string } | undefined;
		const age = typeof it.ageInDays === 'number' ? it.ageInDays : null;
		jobs.push({
			source: 'glassdoor',
			externalId: id,
			title,
			company: str(employer?.name) ?? 'Empresa não informada',
			companyLogo: str(employer?.logoUrl),
			location: str(location?.name),
			url,
			applyUrl: null,
			salary: glassdoorSalary(it.pay),
			postedAt: age == null ? null : new Date(Date.now() - age * 86_400_000).toISOString(),
			description: htmlToText(str(it.description) ?? '')
		});
	}
	return jobs;
}
