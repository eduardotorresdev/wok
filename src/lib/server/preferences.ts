import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from './db';

const list = z
	.array(z.string().trim().min(1).max(120))
	.max(20)
	.transform((items) => [...new Set(items)]);

export const PreferencesInput = z.object({
	terms: list,
	locations: list,
	remote: z.boolean(),
	area: z.string().trim().max(120),
	seniority: z.string().trim().max(60)
});

export type Preferences = z.infer<typeof PreferencesInput>;
export interface PreferencesDto extends Preferences {
	updatedAt: string | null;
}

export function getPreferences(userId: string): PreferencesDto {
	const row = db()
		.select()
		.from(schema.preferences)
		.where(eq(schema.preferences.userId, userId))
		.get();
	if (!row) {
		return { terms: [], locations: [], remote: false, area: '', seniority: '', updatedAt: null };
	}
	return {
		terms: row.terms,
		locations: row.locations,
		remote: row.remote,
		area: row.area,
		seniority: row.seniority,
		updatedAt: new Date(row.updatedAt).toISOString()
	};
}

/** Returns the saved preferences and whether the area changed (triggers research). */
export function savePreferences(userId: string, input: Preferences) {
	const previous = getPreferences(userId);
	const values = { ...input, updatedAt: Date.now() };
	db()
		.insert(schema.preferences)
		.values({ userId, ...values })
		.onConflictDoUpdate({ target: schema.preferences.userId, set: values })
		.run();
	return {
		preferences: getPreferences(userId),
		areaChanged: !!input.area && input.area.toLowerCase() !== previous.area.toLowerCase()
	};
}
