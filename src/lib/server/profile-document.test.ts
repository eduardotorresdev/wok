import { describe, expect, it, vi } from 'vitest';

vi.mock('./db/index.ts', () => ({ db: () => ({}), schema: {}, sqlite: () => ({}) }));

const { appendToSection } = await import('./profile-document.ts');

describe('appendToSection', () => {
	const doc = '## Experiência\n\n- Fato um\n\n## O que não afirmar\n\n_(a preencher)_\n';

	it('adds to the end of an existing section and leaves the rest untouched', () => {
		const out = appendToSection(doc, 'Experiência', '- Fato dois');
		expect(out).toBe(
			'## Experiência\n\n- Fato um\n- Fato dois\n\n## O que não afirmar\n\n_(a preencher)_\n'
		);
	});

	it('finds the section whatever the accents or case', () => {
		const out = appendToSection(doc, 'o que nao afirmar', '- Não tenho inglês fluente');
		expect(out.endsWith('## O que não afirmar\n\n- Não tenho inglês fluente\n')).toBe(true);
		expect(out.match(/^## /gm)).toHaveLength(2);
	});

	it('creates the section when it does not exist, also in an empty document', () => {
		expect(appendToSection(doc, 'Respostas confirmadas', '- **P** R')).toBe(
			`${doc}\n## Respostas confirmadas\n\n- **P** R\n`
		);
		expect(appendToSection('', 'Respostas confirmadas', '- **P** R')).toBe(
			'## Respostas confirmadas\n\n- **P** R\n'
		);
	});

	it('replaces the placeholder the draft leaves in an empty section', () => {
		const out = appendToSection(doc, 'O que não afirmar', '- Não uso GraphQL');
		expect(out).toBe('## Experiência\n\n- Fato um\n\n## O que não afirmar\n\n- Não uso GraphQL\n');
	});

	it('adds a fact inside the block of the job it belongs to', () => {
		const jobs =
			'## Experiência\n\n### Sênior — Globo (2021--atual)\n- A\n\n### Engenheira — Nubank (2017--2021)\n- B\n\n## Formação\n\n- USP\n';
		expect(appendToSection(jobs, 'Experiência', '- Novo', 'Sênior — Globo (2021--atual)')).toBe(
			'## Experiência\n\n### Sênior — Globo (2021--atual)\n- A\n- Novo\n\n### Engenheira — Nubank (2017--2021)\n- B\n\n## Formação\n\n- USP\n'
		);
		// A job that has no block falls back to the end of the section.
		expect(appendToSection(jobs, 'Experiência', '- Novo', 'Estágio — Outra')).toBe(
			'## Experiência\n\n### Sênior — Globo (2021--atual)\n- A\n\n### Engenheira — Nubank (2017--2021)\n- B\n- Novo\n\n## Formação\n\n- USP\n'
		);
	});

	it('puts text right under a heading that has no content yet', () => {
		expect(appendToSection('## Formação\n\n## Experiência\n\n- x\n', 'Formação', '- Curso')).toBe(
			'## Formação\n\n- Curso\n\n## Experiência\n\n- x\n'
		);
	});
});
