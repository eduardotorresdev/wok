import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, envVar } from './env';

export interface CompileResult {
	ok: boolean;
	/** 0 when compilation failed. */
	pages: number;
	pdfPath: string | null;
	log: string;
}

const MAX_LOG = 12_000;
const TIMEOUT_MS = 120_000;

function run(cmd: string, args: string[], cwd: string) {
	return new Promise<{ code: number | null; out: string; missing: boolean }>((resolve) => {
		execFile(
			cmd,
			args,
			{ cwd, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, env: { ...process.env } },
			(err, stdout, stderr) => {
				const out = `${stdout ?? ''}${stderr ?? ''}`;
				if (!err) return resolve({ code: 0, out, missing: false });
				const e = err as NodeJS.ErrnoException & { code?: string | number };
				if (e.code === 'ENOENT') return resolve({ code: null, out, missing: true });
				resolve({
					code: typeof e.code === 'number' ? e.code : 1,
					out: out || String(err.message),
					missing: false
				});
			}
		);
	});
}

async function countPages(pdfPath: string, log: string): Promise<number> {
	const info = await run('pdfinfo', [pdfPath], path.dirname(pdfPath));
	const m = info.out.match(/^Pages:\s+(\d+)/m);
	if (m) return Number(m[1]);
	const fromLog = log.match(/Output written on .*?\((\d+) pages?/);
	if (fromLog) return Number(fromLog[1]);
	// Last resort: page objects in an uncompressed PDF.
	const raw = (await fs.readFile(pdfPath)).toString('latin1');
	return (raw.match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
}

function tail(log: string) {
	return log.length > MAX_LOG ? '…' + log.slice(-MAX_LOG) : log;
}

/** Extracts the lines a human (or the tailoring agent) needs from a TeX log. */
export function latexErrors(log: string): string {
	const lines = log.split('\n');
	const picked: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (
			/^(!|error:|l\.\d+ )/.test(lines[i]) ||
			/Undefined control sequence|Emergency stop/.test(lines[i])
		) {
			picked.push(...lines.slice(i, i + 3));
			i += 2;
		}
	}
	return picked.slice(0, 40).join('\n');
}

/**
 * Compiles `latex` inside `dir` (created if needed) to `<dir>/<name>.pdf`.
 * Shell escape is disabled: the source comes from users and from the model.
 */
export async function compileLatex(
	latex: string,
	dir: string,
	name = 'main'
): Promise<CompileResult> {
	await fs.mkdir(dir, { recursive: true });
	const tex = path.join(dir, `${name}.tex`);
	const pdf = path.join(dir, `${name}.pdf`);
	await fs.writeFile(tex, latex, 'utf8');
	await fs.rm(pdf, { force: true });

	const tectonic = envVar('TECTONIC_BIN') || 'tectonic';
	let res = await run(
		tectonic,
		['-X', 'compile', '--untrusted', '--keep-logs', '--outdir', dir, tex],
		dir
	);
	if (res.missing) {
		res = await run(
			'pdflatex',
			[
				'-interaction=nonstopmode',
				'-halt-on-error',
				'-no-shell-escape',
				`-output-directory=${dir}`,
				tex
			],
			dir
		);
	}
	if (res.missing) {
		return {
			ok: false,
			pages: 0,
			pdfPath: null,
			log: 'Nenhum compilador LaTeX encontrado no servidor (tectonic ou pdflatex).'
		};
	}

	let log = res.out;
	try {
		log += '\n' + (await fs.readFile(path.join(dir, `${name}.log`), 'utf8'));
	} catch {
		// tectonic only writes the .log when the engine actually ran
	}

	const exists = await fs
		.stat(pdf)
		.then((s) => s.size > 0)
		.catch(() => false);
	if (res.code !== 0 || !exists) {
		return { ok: false, pages: 0, pdfPath: null, log: tail(log) };
	}
	return { ok: true, pages: await countPages(pdf, log), pdfPath: pdf, log: tail(log) };
}

export function hashLatex(latex: string) {
	return createHash('sha256').update(latex).digest('hex');
}

export function userDir(userId: string, ...parts: string[]) {
	// Better Auth ids are url-safe, but never let one escape DATA_DIR.
	const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
	return path.join(config.dataDir, 'users', safe, ...parts);
}

const locks = new Map<string, Promise<unknown>>();

/** Serializes work per key (one compile per user at a time). */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const prev = locks.get(key) ?? Promise.resolve();
	const next = prev.then(fn, fn);
	locks.set(
		key,
		next.finally(() => {
			if (locks.get(key) === tracked) locks.delete(key);
		})
	);
	const tracked = locks.get(key)!;
	return next;
}
