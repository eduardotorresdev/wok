import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';

// The same opening is often posted on both job boards. Glassdoor's own flow
// ends in a human check, so a Glassdoor posting that has a LinkedIn twin is
// applied to through the LinkedIn one, and only one card is shown for both.

const plain = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

// Words that vary between the two sites' spelling of one company name.
const COMPANY_NOISE = new Set(
	'sa s a ltda inc llc group grupo brasil brazil do da de e the corp corporation company cia holding'.split(
		' '
	)
);

function companyTokens(company: string) {
	return plain(company)
		.split(' ')
		.filter((t) => t && !COMPANY_NOISE.has(t));
}

const contains = (all: string[], part: string[]) =>
	part.length > 0 && part.every((t) => all.includes(t));

/**
 * Same opening: identical title once case, accents and punctuation are set
 * aside, and one company name contained in the other ("Itaú Unibanco" and
 * "Itaú Unibanco Holding S.A."). A title that merely starts the same is not
 * enough: a company posts many openings that differ only at the end.
 */
export function sameOpening(
	a: { title: string; company: string },
	b: { title: string; company: string }
) {
	if (plain(a.title) !== plain(b.title)) return false;
	const ca = companyTokens(a.company);
	const cb = companyTokens(b.company);
	return contains(ca, cb) || contains(cb, ca);
}

/** Points each Glassdoor posting of this user at its LinkedIn twin, when it has one. */
export function linkTwins(userId: string) {
	const jobs = db()
		.select({
			id: schema.job.id,
			source: schema.job.source,
			title: schema.job.title,
			company: schema.job.company,
			applyUrl: schema.job.applyUrl,
			viaJobId: schema.job.viaJobId
		})
		.from(schema.job)
		.where(eq(schema.job.userId, userId))
		.all();
	const linkedin = jobs.filter((j) => j.source === 'linkedin');
	let linked = 0;
	for (const job of jobs) {
		if (job.source !== 'glassdoor' || job.viaJobId || job.applyUrl) continue;
		const twin = linkedin.find((l) => sameOpening(l, job));
		if (!twin) continue;
		db()
			.update(schema.job)
			.set({ viaJobId: twin.id })
			.where(and(eq(schema.job.userId, userId), eq(schema.job.id, job.id)))
			.run();
		linked++;
	}
	return linked;
}
