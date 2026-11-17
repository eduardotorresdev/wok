import type Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';
import { EFFORT, MODEL, anthropic, describeLlmError, hasLlm } from './llm.ts';
import { matchArea, playbooks } from './playbooks.ts';

const MAX_TURNS = 6;

export function areaKey(area: string) {
	return area
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** The stored research for an area, as the JSON text produced by the researcher. */
export function getAreaStrategy(area: string): string | null {
	const key = areaKey(area);
	if (!key) return null;
	const row = db()
		.select()
		.from(schema.areaStrategy)
		.where(eq(schema.areaStrategy.area, key))
		.get();
	return row?.content ?? null;
}

function extractJson(text: string): Record<string, unknown> | null {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

const running = new Map<string, Promise<string | null>>();

/**
 * Short web research on what makes applications work in the user's area.
 * Runs once per area (onboarding or area change); the result feeds the
 * tailoring and applying agents. Returns null when it could not be produced.
 */
export function researchArea(input: {
	area: string;
	seniority: string;
	country: string;
}): Promise<string | null> {
	const key = areaKey(input.area);
	if (!key || !hasLlm()) return Promise.resolve(null);
	const existing = getAreaStrategy(input.area);
	if (existing) return Promise.resolve(existing);
	let task = running.get(key);
	if (!task) {
		task = run(key, input).finally(() => running.delete(key));
		running.set(key, task);
	}
	return task;
}

async function run(
	key: string,
	input: { area: string; seniority: string; country: string }
): Promise<string | null> {
	const playbook = matchArea(input.area);
	const messages: Anthropic.MessageParam[] = [
		{
			role: 'user',
			content: [
				`area: ${input.area}`,
				`senioridade: ${input.seniority || 'não informada'}`,
				`pais_alvo: ${input.country || 'Brasil'}`,
				`idioma_vagas: pt`,
				`playbook_existente: ${playbook ? playbook.slug : 'null'}`
			].join('\n')
		}
	];
	try {
		let final: Anthropic.Message | undefined;
		for (let turn = 0; turn < MAX_TURNS; turn++) {
			const response = await anthropic()
				.messages.stream({
					model: MODEL,
					max_tokens: 16000,
					system: playbooks.researcher(),
					output_config: { effort: EFFORT },
					tools: [
						{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
						{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10 }
					],
					messages
				})
				.finalMessage();
			// A long server-tool turn can pause; sending it back lets the server continue.
			if (response.stop_reason === 'pause_turn') {
				messages.push({ role: 'assistant', content: response.content });
				continue;
			}
			final = response;
			break;
		}
		if (!final || final.stop_reason !== 'end_turn') {
			console.error(`[researcher] "${input.area}" ended with ${final?.stop_reason ?? 'no answer'}`);
			return null;
		}
		const text = final.content
			.filter((b): b is Anthropic.TextBlock => b.type === 'text')
			.map((b) => b.text)
			.join('');
		const parsed = extractJson(text);
		if (!parsed) {
			console.error(`[researcher] "${input.area}" did not return JSON`);
			return null;
		}
		const content = JSON.stringify(parsed, null, 1);
		const sources = Array.isArray(parsed.fontes)
			? parsed.fontes
					.map((f) => (f && typeof f === 'object' ? (f as { url?: unknown }).url : null))
					.filter((u): u is string => typeof u === 'string')
			: [];
		const updatedAt = Date.now();
		db()
			.insert(schema.areaStrategy)
			.values({ area: key, content, sources, updatedAt })
			.onConflictDoUpdate({
				target: schema.areaStrategy.area,
				set: { content, sources, updatedAt }
			})
			.run();
		return content;
	} catch (err) {
		console.error(`[researcher] "${input.area}" failed:`, describeLlmError(err));
		return null;
	}
}
