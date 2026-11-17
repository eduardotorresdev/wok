import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { config } from '../env.ts';

export const MODEL = 'claude-sonnet-5-5';
export const EFFORT = 'medium' as const;

let client: Anthropic | undefined;

export function hasLlm() {
	return !!config.anthropicApiKey;
}

export function anthropic() {
	if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 3 });
	return client;
}

export class LlmRefusal extends Error {}

/** One structured (schema-validated) answer from Sonnet. */
export async function structured<T extends z.ZodType>(opts: {
	schema: T;
	system: string;
	user: string;
	maxTokens?: number;
	/**
	 * Text that repeats across calls (the person's profile): sent as a second,
	 * cached system block so only the first call of a series pays for it.
	 */
	context?: string | null;
}): Promise<z.infer<T>> {
	const response = await anthropic().messages.parse({
		model: MODEL,
		max_tokens: opts.maxTokens ?? 16000,
		system: opts.context
			? [
					{ type: 'text', text: opts.system },
					{ type: 'text', text: opts.context, cache_control: { type: 'ephemeral' } }
				]
			: opts.system,
		messages: [{ role: 'user', content: opts.user }],
		output_config: { effort: EFFORT, format: zodOutputFormat(opts.schema) }
	});
	if (response.stop_reason === 'refusal') {
		throw new LlmRefusal(response.stop_details?.explanation ?? 'O modelo recusou o pedido.');
	}
	if (response.stop_reason === 'max_tokens' || response.parsed_output == null) {
		throw new Error(`Resposta do modelo incompleta (stop_reason=${response.stop_reason}).`);
	}
	return response.parsed_output;
}

export function describeLlmError(err: unknown): string {
	if (err instanceof Anthropic.AuthenticationError) return 'Chave da Anthropic inválida.';
	if (err instanceof Anthropic.RateLimitError) return 'Limite de uso da Anthropic atingido.';
	if (err instanceof Anthropic.APIError) return `Erro da Anthropic (${err.status}): ${err.message}`;
	return err instanceof Error ? err.message : String(err);
}
