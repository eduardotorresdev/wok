import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compileLatex, detectEngine } from './latex.ts';

// A résumé is untrusted input and its PDF goes back to whoever sent it, so a
// compile must never be able to read the server's files. These tests try, with
// every engine, to pull a file from outside the working directory into the PDF.

const SECRET = 'WOK_SECRET_7f3a9c21';
let outside: string;
let out: string;

beforeAll(async () => {
	outside = await fs.mkdtemp(path.join(os.tmpdir(), 'wok-secret-'));
	await fs.writeFile(path.join(outside, 'secret.env'), `API_KEY=${SECRET}\n`);
	out = await fs.mkdtemp(path.join(os.tmpdir(), 'wok-test-out-'));
});

afterAll(async () => {
	await fs.rm(outside, { recursive: true, force: true });
	await fs.rm(out, { recursive: true, force: true });
});

const thief = (engine: string) => `\\documentclass{article}
\\usepackage{verbatim}
\\begin{document}
Antes.
\\IfFileExists{/etc/hostname}{HOSTFILE-VISIBLE \\input{/etc/hostname}}{sem hostname}
\\IfFileExists{${'${SECRET_FILE}'}}{\\verbatiminput{${'${SECRET_FILE}'}}}{sem segredo}
\\newread\\f \\openin\\f=${'${SECRET_FILE}'} \\ifeof\\f fechado \\else \\read\\f to \\linha \\linha \\fi
${engine === 'lualatex' ? '\\directlua{local f = io.open("${SECRET_FILE}") if f then tex.print(f:read("a")) end}' : ''}
Depois.
\\end{document}`;

describe('LaTeX sandbox', () => {
	for (const engine of ['pdflatex', 'xelatex', 'lualatex', 'tectonic'] as const) {
		it(`${engine} cannot read files outside its working directory`, async () => {
			const secretFile = path.join(outside, 'secret.env');
			const source = thief(engine).replaceAll('${SECRET_FILE}', secretFile);
			const result = await compileLatex(source, path.join(out, engine), 'main', { engine });
			const seen = `${result.text ?? ''}\n${result.log}\n${result.errors.join('\n')}`;
			expect(seen).not.toContain(SECRET);
			expect(seen).not.toContain('HOSTFILE-VISIBLE');
			if (result.ok && result.pdfPath) {
				const raw = (await fs.readFile(result.pdfPath)).toString('latin1');
				expect(raw).not.toContain(SECRET);
			}
		}, 400_000);
	}

	it('still compiles an ordinary pdfLaTeX document to one page', async () => {
		const result = await compileLatex(
			'\\documentclass{article}\\usepackage[utf8]{inputenc}\\usepackage[T1]{fontenc}\\begin{document}Currículo de teste: ação, coração.\\end{document}',
			path.join(out, 'plain')
		);
		expect(result.errors).toEqual([]);
		expect(result.ok).toBe(true);
		expect(result.pages).toBe(1);
		expect(result.text).toContain('ação');
	}, 200_000);
});

describe('detectEngine', () => {
	it('defaults to pdfLaTeX and follows Unicode-font packages', () => {
		expect(detectEngine('\\usepackage[T1]{fontenc}\\pdfgentounicode=1')).toBe('pdflatex');
		expect(detectEngine('\\usepackage{fontspec}')).toBe('xelatex');
		expect(detectEngine('% \\usepackage{fontspec}\n\\usepackage{microtype}')).toBe('pdflatex');
		expect(detectEngine('\\usepackage{luacode}')).toBe('lualatex');
	});
});
