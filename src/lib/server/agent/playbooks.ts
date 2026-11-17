import index from './playbooks/index.json';

// Markdown written by the HR researcher, bundled at build time.
const files = import.meta.glob('./playbooks/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

function read(file: string) {
	return files[`./playbooks/${file.endsWith('.md') ? file : `${file}.md`}`] ?? '';
}

function tokens(text: string) {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

/** True when `phrase` appears in `area` as whole consecutive tokens (never as a substring). */
function containsPhrase(area: string[], phrase: string[]) {
	if (!phrase.length || phrase.length > area.length) return false;
	for (let i = 0; i <= area.length - phrase.length; i++) {
		if (phrase.every((t, j) => area[i + j] === t)) return true;
	}
	return false;
}

export interface AreaPlaybook {
	slug: string;
	title: string;
	content: string;
}

/** The area playbook whose title, slug or a synonym matches the user's area; longest match wins. */
export function matchArea(area: string): AreaPlaybook | null {
	const areaTokens = tokens(area);
	if (!areaTokens.length) return null;
	let best: { entry: (typeof index.areas)[number]; size: number } | null = null;
	for (const entry of index.areas) {
		for (const candidate of [entry.title, entry.slug, ...entry.synonyms]) {
			const phrase = tokens(candidate);
			if (containsPhrase(areaTokens, phrase) && (!best || phrase.length > best.size)) {
				best = { entry, size: phrase.length };
			}
		}
	}
	if (!best) return null;
	const content = read(best.entry.file);
	return content ? { slug: best.entry.slug, title: best.entry.title, content } : null;
}

export const playbooks = {
	resume: () => read('geral-curriculo'),
	tailoring: () => read('geral-adaptacao-vaga'),
	applying: () => read('geral-inscricao'),
	researcher: () => read(index.researcher)
};
