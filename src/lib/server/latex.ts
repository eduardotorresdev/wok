import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config, envVar } from './env';

export interface CompileResult {
	ok: boolean;
	/** 0 when compilation failed. */
	pages: number;
	pdfPath: string | null;
	log: string;
	/** One sentence in Portuguese about why it failed, when the cause is a known one. */
	explanation: string | null;
	/** The error messages from the log, whole, one per item. */
	errors: string[];
	/** Text extracted from the PDF (pdftotext -layout); null when unavailable. */
	text: string | null;
	/** Problems a reader or an applicant-tracking parser would hit in the extracted text. */
	textIssues: string[];
}

const MAX_LOG = 12_000;
const TIMEOUT_MS = 90_000;
const INSTALL_TIMEOUT_MS = 120_000;

function run(
	cmd: string,
	args: string[],
	cwd: string,
	env?: NodeJS.ProcessEnv,
	timeout = TIMEOUT_MS
) {
	return new Promise<{ code: number | null; out: string; missing: boolean }>((resolve) => {
		execFile(
			cmd,
			args,
			{ cwd, timeout, maxBuffer: 16 * 1024 * 1024, env: env ?? { ...process.env } },
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

async function extractText(pdfPath: string): Promise<string | null> {
	const res = await run(
		'pdftotext',
		['-layout', '-enc', 'UTF-8', pdfPath, '-'],
		path.dirname(pdfPath)
	);
	return res.missing || res.code !== 0 ? null : res.out;
}

function textIssues(text: string | null, log: string): string[] {
	const issues: string[] = [];
	if (text !== null) {
		if (text.trim().length < 200) issues.push('Quase nenhum texto extraível do PDF.');
		if (/\uFFFD/.test(text)) issues.push('Há caracteres ilegíveis (U+FFFD) no texto extraído.');
		const ligatures = [...new Set(text.match(/[\uFB00-\uFB06]/g) ?? [])];
		if (ligatures.length) {
			issues.push(
				`O texto extraído tem ligaduras tipográficas (${ligatures.join(' ')}) no lugar de letras separadas, o que quebra buscas por palavras como "traffic" ou "flows". Desative as ligaduras: em pdfLaTeX, \\usepackage{microtype} com \\DisableLigatures{encoding = *, family = *}; com fontspec, Ligatures=NoCommon.`
			);
		}
	}
	const missing = [...new Set(log.match(/Missing character: There is no \S+/g) ?? [])];
	if (missing.length) {
		issues.push(
			`Caracteres sem glifo na fonte, que somem do PDF: ${missing
				.map((m) => m.replace('Missing character: There is no ', ''))
				.slice(0, 8)
				.join(' ')}`
		);
	}
	return issues;
}

function tail(log: string) {
	return log.length > MAX_LOG ? '…' + log.slice(-MAX_LOG) : log;
}

// ---------------------------------------------------------------- engines

export type Engine = 'pdflatex' | 'xelatex' | 'lualatex';

/** Source without comments, so a commented-out \usepackage does not pick the engine. */
function uncommented(latex: string) {
	return latex.replace(/(^|[^\\])%.*$/gm, '$1');
}

/**
 * Picks the engine the source was written for. Nearly every résumé template
 * targets pdfLaTeX (inputenc, fontenc, \pdfgentounicode, microtype's
 * \DisableLigatures), so that is the default; only sources that load
 * Unicode-font packages need XeLaTeX or LuaLaTeX.
 */
export function detectEngine(latex: string): Engine {
	const src = uncommented(latex);
	if (
		/\\usepackage(\[[^\]]*\])?\{[^}]*\b(luacode|luatextra|luaotfload)\b|\\directlua\b/.test(src)
	) {
		return 'lualatex';
	}
	if (
		/\\usepackage(\[[^\]]*\])?\{[^}]*\b(fontspec|unicode-math|polyglossia|xeCJK|xltxtra|mathspec)\b/.test(
			src
		) ||
		/\\(setmainfont|setsansfont|setmonofont|newfontfamily)\b/.test(src)
	) {
		return 'xelatex';
	}
	return 'pdflatex';
}

let texBin: Promise<string | null> | undefined;

/** Directory with the TeX Live binaries: LATEX_BIN_DIR, else a user-space TinyTeX, else PATH. */
function texBinDir() {
	texBin ??= (async () => {
		const configured = envVar('LATEX_BIN_DIR');
		if (configured) return configured;
		const root = path.join(os.homedir(), '.TinyTeX', 'bin');
		const archs = await fs.readdir(root).catch(() => [] as string[]);
		return archs.length ? path.join(root, archs[0]) : null;
	})();
	return texBin;
}

async function texCommand(name: string) {
	const dir = await texBinDir();
	return dir ? path.join(dir, name) : name;
}

/** Environment for the engine: long log lines are not wrapped, so an error is reported whole. */
async function texEnv(extra: NodeJS.ProcessEnv = {}): Promise<NodeJS.ProcessEnv> {
	const dir = await texBinDir();
	return {
		PATH: [dir, '/usr/bin', '/bin'].filter(Boolean).join(path.delimiter),
		HOME: process.env.HOME,
		LANG: 'C.UTF-8',
		openout_any: 'p',
		max_print_line: '2000',
		error_line: '254',
		half_error_line: '238',
		...extra
	};
}

// ---------------------------------------------------------------- sandbox

const WORK = '/work';
const MEMORY_KB = 3 * 1024 * 1024;
/** 512-byte blocks: no single output file above 64 MB. */
const FILE_BLOCKS = 64 * 2048;
const CPU_SECONDS = 120;

/** Absolute path of a program, or null when it is not installed. */
async function resolveProgram(cmd: string) {
	if (path.isAbsolute(cmd)) {
		return fs.access(cmd).then(
			() => cmd,
			() => null
		);
	}
	const found = await run('/usr/bin/which', [cmd], os.tmpdir());
	return found.code === 0 && found.out.trim() ? found.out.trim().split('\n')[0] : null;
}
let bwrapChecked: Promise<boolean> | undefined;

function hasBwrap() {
	bwrapChecked ??= run('bwrap', ['--version'], os.tmpdir()).then((r) => !r.missing && r.code === 0);
	return bwrapChecked;
}

/**
 * Runs a TeX engine where the only things it can see are the system
 * libraries, the TeX tree and its own working directory, with no network.
 * TeX can \input any file its user can read (TeX Live 2026 no longer honors
 * openin_any), and the source comes from users and from the model: without
 * this a résumé could print the server's .env or another user's data.
 */
async function runSandboxed(
	cmd: string,
	args: string[],
	work: string,
	env: NodeJS.ProcessEnv,
	readOnly: string[]
) {
	if (!(await hasBwrap())) {
		return {
			code: 1,
			missing: false,
			out: 'Compilação recusada: o isolamento (bubblewrap) não está disponível no servidor. Instale o pacote bubblewrap.'
		};
	}
	const binds: string[] = [];
	for (const dir of [
		'/usr',
		'/bin',
		'/lib',
		'/lib64',
		'/etc/fonts',
		'/etc/alternatives',
		...readOnly
	]) {
		const real = await fs.realpath(dir).catch(() => null);
		if (!real) continue;
		// On merged-/usr systems /bin and /lib are links into /usr.
		if (real !== dir && real.startsWith('/usr/')) binds.push('--symlink', real.slice(1), dir);
		else binds.push('--ro-bind', dir, dir);
	}
	return run(
		'bwrap',
		[
			'--unshare-all',
			'--die-with-parent',
			'--new-session',
			...binds,
			'--proc',
			'/proc',
			'--dev',
			'/dev',
			'--tmpfs',
			'/tmp',
			'--bind',
			work,
			WORK,
			'--chdir',
			WORK,
			'--clearenv',
			...Object.entries({
				...env,
				HOME: WORK,
				TEXMFVAR: `${WORK}/.texmf-var`,
				TMPDIR: '/tmp'
			}).flatMap(([k, v]) => (v == null ? [] : ['--setenv', k, v])),
			// Memory, file size and CPU time are capped inside the sandbox.
			'/bin/sh',
			'-c',
			`ulimit -v ${MEMORY_KB}; ulimit -f ${FILE_BLOCKS}; ulimit -t ${CPU_SECONDS}; exec "$@"`,
			'sh',
			cmd,
			...args
		],
		work,
		{ PATH: process.env.PATH }
	);
}

const MISSING_FILE =
	/! (?:LaTeX|Package \S+) Error: File `([A-Za-z0-9_.-]+\.(?:sty|cls|def|fd|clo|ldf|cfg|tex))' not found/;
const MAX_INSTALLS = 6;
const installLock = { tail: Promise.resolve() as Promise<unknown> };

/**
 * Installs the TeX Live package that provides `file` (user-space tlmgr, no
 * root). One install at a time for the whole process: tlmgr is not reentrant.
 */
function installProviderOf(file: string): Promise<string | null> {
	const job = installLock.tail.then(async () => {
		const tlmgr = await texCommand('tlmgr');
		const env = await texEnv();
		const found = await run(
			tlmgr,
			['search', '--global', '--file', `/${file}`],
			os.tmpdir(),
			env,
			INSTALL_TIMEOUT_MS
		);
		if (found.missing || found.code !== 0) return null;
		// Output is "package:" lines followed by indented paths.
		const pkg = found.out.match(/^([A-Za-z0-9][A-Za-z0-9._-]*):\s*$/m)?.[1];
		if (!pkg) return null;
		const installed = await run(tlmgr, ['install', pkg], os.tmpdir(), env, INSTALL_TIMEOUT_MS);
		console.log(`[latex] tlmgr install ${pkg} for ${file}: exit ${installed.code}`);
		return installed.code === 0 ? pkg : null;
	});
	installLock.tail = job.catch(() => {});
	return job;
}

// ---------------------------------------------------------------- errors

/**
 * A TeX log wraps long lines at 79 columns and packages continue a message on
 * "(package)   more text" lines; glue the pieces of each message back together.
 */
function unwrap(log: string) {
	const out: string[] = [];
	for (const line of log.split('\n')) {
		const prev = out.at(-1);
		const continuation = line.match(/^\((?:[A-Za-z0-9_-]+)\)\s{2,}(.*)$/);
		if (prev !== undefined && continuation) {
			out[out.length - 1] = `${prev} ${continuation[1].trim()}`.trimEnd();
		} else if (prev !== undefined && prev.length === 79 && !/^(!|l\.\d+ )/.test(line)) {
			out[out.length - 1] = prev + line;
		} else {
			out.push(line);
		}
	}
	return out;
}

/** The error messages of a TeX log, each one whole and followed by the source line it points at. */
export function latexErrorList(log: string): string[] {
	const lines = unwrap(log);
	const picked: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trimEnd();
		if (/^!\s+==> Fatal error|^! Emergency stop/.test(line)) continue;
		if (/^(!|error:)/.test(line)) {
			const where = lines.slice(i + 1, i + 12).find((l) => /^l\.\d+ /.test(l));
			picked.push(where ? `${line}\n${where.trimEnd()}` : line);
		}
	}
	return [...new Set(picked)].slice(0, 20);
}

/** Same, as one block of text (what the tailoring agent reads). */
export function latexErrors(log: string): string {
	return latexErrorList(log).join('\n');
}

/** One sentence in Portuguese for the usual causes, so the person knows what to do. */
export function explainLatexError(log: string, engine: Engine | 'tectonic'): string | null {
	const text = unwrap(log).join('\n');
	const file = text.match(/File `([^']+)' not found/)?.[1];
	if (file) {
		return `O pacote ou arquivo "${file}" não está instalado no servidor e não consegui instalá-lo automaticamente.`;
	}
	if (
		/only possible with pdftex|\\pdfgentounicode|pdfTeX.*required|Undefined control sequence[\s\S]{0,200}\\pdf[a-z]+/i.test(
			text
		)
	) {
		return `Este currículo foi escrito para o motor pdfLaTeX, mas foi compilado com ${engine}, que não aceita esses comandos.`;
	}
	if (
		/fontspec Error|requires either XeTeX or LuaTeX|must be compiled with XeLaTeX|The fontspec package requires/i.test(
			text
		)
	) {
		return `Este currículo usa fontes Unicode (fontspec) e precisa do motor XeLaTeX ou LuaLaTeX; foi compilado com ${engine}.`;
	}
	const font = text.match(
		/Font (\S+) at \d+ not found|Font \\?\S*=(\S+) not loadable|The font "([^"]+)" cannot be found/
	);
	if (font) return `A fonte "${font[1] ?? font[2] ?? font[3]}" não está instalada no servidor.`;
	if (/Undefined control sequence/.test(text)) {
		return 'O fonte usa um comando que não existe: falta um \\usepackage ou há erro de digitação no nome do comando.';
	}
	if (/Missing \$ inserted/.test(text)) {
		return 'Há um caractere especial de matemática (como _ ou ^) fora de $...$; escreva \\_ ou \\^{} no texto.';
	}
	if (/Runaway argument|File ended while scanning|Missing } inserted|Extra }/.test(text)) {
		return 'Há chaves { } desbalanceadas no fonte.';
	}
	if (/Misplaced alignment tab character &/.test(text)) {
		return 'Há um & solto no texto; escreva \\& quando não for separador de tabela.';
	}
	if (/timed out|ETIMEDOUT|SIGTERM/.test(text)) return 'A compilação passou do tempo limite.';
	return null;
}

// ---------------------------------------------------------------- compile

const failure = (
	log: string,
	explanation: string | null = null,
	errors: string[] = []
): CompileResult => ({
	ok: false,
	pages: 0,
	pdfPath: null,
	log: tail(log),
	explanation,
	errors,
	text: null,
	textIssues: []
});

/**
 * Compiles `latex` to `<dir>/<name>.pdf` (dir is created if needed) with the
 * engine the source was written for. The engine runs sandboxed in a throwaway
 * directory, with shell escape off. A package the log reports as missing is installed
 * and the compile repeated. The source is never altered.
 */
export async function compileLatex(
	latex: string,
	dir: string,
	name = 'main',
	options: { engine?: Engine | 'tectonic' } = {}
): Promise<CompileResult> {
	await fs.mkdir(dir, { recursive: true });
	const pdf = path.join(dir, `${name}.pdf`);
	await fs.writeFile(path.join(dir, `${name}.tex`), latex, 'utf8');
	await fs.rm(pdf, { force: true });

	const work = await fs.mkdtemp(path.join(os.tmpdir(), 'wok-tex-'));
	try {
		await fs.writeFile(path.join(work, 'main.tex'), latex, 'utf8');
		const wanted = options.engine ?? detectEngine(latex);
		let used: Engine | 'tectonic' = wanted;
		const args = ['-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', 'main.tex'];
		const engine = wanted === 'tectonic' ? null : await resolveProgram(await texCommand(wanted));

		let res: Awaited<ReturnType<typeof run>> = { code: null, out: '', missing: true };
		if (engine) {
			const env = await texEnv();
			// The whole TeX tree is visible read-only: <root>/bin/<arch>/<engine>.
			const texRoot = path.dirname(path.dirname(path.dirname(await fs.realpath(engine))));
			const compile = () => runSandboxed(engine, args, work, env, [texRoot]);
			res = await compile();
			for (let n = 0; n < MAX_INSTALLS && res.code !== 0; n++) {
				const file = res.out.match(MISSING_FILE)?.[1];
				if (!file || !(await installProviderOf(file))) break;
				res = await compile();
			}
		} else {
			// No TeX Live on this machine: tectonic (a XeTeX engine) is better than nothing.
			used = 'tectonic';
			const tectonic = await resolveProgram(envVar('TECTONIC_BIN') || 'tectonic');
			if (tectonic) {
				const tectonicBin = await fs.realpath(tectonic);
				const cache = path.join(os.homedir(), '.cache', 'Tectonic');
				res = await runSandboxed(
					tectonicBin,
					// The sandbox has no network: only what an earlier run already cached.
					['-X', 'compile', '--untrusted', '--only-cached', '--keep-logs', 'main.tex'],
					work,
					{ PATH: '/usr/bin:/bin', XDG_CACHE_HOME: path.join(os.homedir(), '.cache') },
					[cache, tectonicBin]
				);
			}
		}
		if (res.missing) {
			const none = 'Nenhum compilador LaTeX encontrado no servidor (pdflatex ou tectonic).';
			return failure(none, none);
		}

		let log = res.out;
		const fileLog = await fs.readFile(path.join(work, 'main.log'), 'utf8').catch(() => '');
		if (fileLog && !log.includes(fileLog.slice(0, 200))) log += '\n' + fileLog;
		await fs.writeFile(path.join(dir, `${name}.log`), log, 'utf8').catch(() => {});

		const built = path.join(work, 'main.pdf');
		const exists = await fs
			.stat(built)
			.then((s) => s.size > 0)
			.catch(() => false);
		if (res.code !== 0 || !exists) {
			const errors = latexErrorList(log);
			return failure(log, explainLatexError(log, used), errors);
		}
		await fs.copyFile(built, pdf);
		const text = await extractText(pdf);
		return {
			ok: true,
			pages: await countPages(pdf, log),
			pdfPath: pdf,
			log: tail(log),
			explanation: null,
			errors: [],
			text,
			textIssues: textIssues(text, log)
		};
	} finally {
		await fs.rm(work, { recursive: true, force: true }).catch(() => {});
	}
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
