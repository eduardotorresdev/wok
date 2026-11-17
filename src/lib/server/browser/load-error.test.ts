import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.ts', () => ({ sqlite: () => ({}), db: () => ({}), schema: {} }));

const { loadErrorText } = await import('./service.ts');

describe('loadErrorText', () => {
	it('says in Portuguese why the page did not open, without technical text', () => {
		const cases: [string, RegExp][] = [
			['page.goto: Timeout 30000ms exceeded.', /demorou demais/],
			['page.goto: net::ERR_NAME_NOT_RESOLVED at https://x.invalid/', /Endereço não encontrado/],
			['page.goto: net::ERR_CONNECTION_REFUSED at https://x/', /recusou a conexão/],
			['page.goto: net::ERR_INTERNET_DISCONNECTED', /sem internet/],
			['page.goto: net::ERR_CONNECTION_RESET', /conexão com o site caiu/],
			['something nobody foresaw', /Não foi possível abrir a página/]
		];
		for (const [raw, expected] of cases) {
			const text = loadErrorText(new Error(raw));
			expect(text).toMatch(expected);
			expect(text).not.toMatch(/page\.goto|net::|ERR_|Timeout|exceeded/);
		}
	});
});
