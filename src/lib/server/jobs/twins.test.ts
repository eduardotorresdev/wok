import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.ts', () => ({ db: () => ({}), schema: {} }));

const { sameOpening } = await import('./twins.ts');

describe('sameOpening', () => {
	it('matches the same title under two spellings of one company', () => {
		expect(
			sameOpening(
				{
					title: 'Engenharia de Software Frontend Sênior - SEGUROS SOLUÇÕES',
					company: 'Itaú Unibanco'
				},
				{
					title: 'Engenharia de software frontend sênior – Seguros Soluções',
					company: 'Itaú Unibanco Holding S.A.'
				}
			)
		).toBe(true);
	});

	it('keeps apart openings of one company that differ in the title', () => {
		expect(
			sameOpening(
				{ title: 'Engenheiro de Software Sênior - IT CRM', company: 'Mercado Livre' },
				{ title: 'Engenheiro de Software Sênior', company: 'Mercado Livre' }
			)
		).toBe(false);
	});

	it('keeps apart the same title at different companies', () => {
		expect(
			sameOpening(
				{ title: 'Desenvolvedor Frontend Sênior', company: 'Banco do Brasil' },
				{ title: 'Desenvolvedor Frontend Sênior', company: 'Grupo Boticário' }
			)
		).toBe(false);
		// A name made only of generic words matches nothing.
		expect(
			sameOpening(
				{ title: 'Desenvolvedor', company: 'Grupo Brasil S.A.' },
				{ title: 'Desenvolvedor', company: 'Acme' }
			)
		).toBe(false);
	});
});
