import type { ApplicationStatus, Job, Provider } from './types.ts';

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function relativeTime(iso: string | null | undefined) {
	if (!iso) return '';
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return '';
	const minutes = Math.round((then - Date.now()) / 60_000);
	if (Math.abs(minutes) < 1) return 'agora';
	if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
	const days = Math.round(hours / 24);
	if (Math.abs(days) < 30) return rtf.format(days, 'day');
	return rtf.format(Math.round(days / 30), 'month');
}

export const sourceLabel = (source: Job['source']) =>
	source === 'linkedin' ? 'LinkedIn' : source === 'glassdoor' ? 'Glassdoor' : source;

/** O contrato não fixa a escala; aceita 0–1 ou 0–100. */
export function scorePercent(score: number | null | undefined) {
	if (score == null || Number.isNaN(score)) return null;
	return Math.round(Math.max(0, Math.min(100, score <= 1 ? score * 100 : score)));
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
	queued: 'Na fila',
	tailoring: 'Ajustando currículo',
	applying: 'Inscrevendo',
	needs_user: 'Precisa de você',
	submitted: 'Enviada',
	failed: 'Falhou'
};

export function clockTime(iso: string) {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? ''
		: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "Inscrição pelo site da empresa", quando o servidor informa o caminho. */
export function applyViaLabel(job: Pick<Job, 'applyVia'>) {
	if (job.applyVia === 'company') return 'Inscrição pelo site da empresa';
	if (job.applyVia === 'linkedin') return 'Inscrição pelo LinkedIn';
	// No Glassdoor o agente prepara e a pessoa envia: isso precisa estar dito antes do gesto.
	if (job.applyVia === 'glassdoor') return 'Você envia pelo Glassdoor';
	return null;
}

export const PROVIDER_NAME: Record<Provider, string> = {
	linkedin: 'LinkedIn',
	glassdoor: 'Glassdoor'
};

/** A conta que falta conectar para aceitar esta vaga, ou null se ela pode ser aceita. */
export function blockedProvider(
	job: Pick<Job, 'canApply' | 'blockedBy' | 'source'>
): Provider | null {
	if (job.canApply !== false) return null;
	return job.blockedBy ?? (job.source === 'glassdoor' ? 'glassdoor' : 'linkedin');
}

/**
 * Erros de um log do TeX, inteiros. O log quebra as linhas em 79 colunas e continua
 * mensagens de pacote em linhas "(pacote)   texto": aqui os pedaços voltam a ser uma frase.
 */
export function latexErrors(log: string): string[] {
	const lines: string[] = [];
	for (const line of log.split('\n')) {
		const prev = lines.at(-1);
		if (prev !== undefined && prev.length === 79 && !/^(!|l\.\d+ )/.test(line)) {
			lines[lines.length - 1] = prev + line;
		} else lines.push(line);
	}
	const found: string[] = [];
	for (let i = 0; i < lines.length && found.length < 3; i += 1) {
		if (!lines[i].startsWith('!')) continue;
		let message = lines[i].replace(/^!\s*/, '');
		let next = i + 1;
		while (next < lines.length && next < i + 6 && /^\(\S+\)\s/.test(lines[next])) {
			message += ' ' + lines[next].replace(/^\(\S+\)\s+/, '').trim();
			next += 1;
		}
		const at = lines.slice(next, next + 8).find((l) => /^l\.\d+ /.test(l));
		if (at) message += `\n${at.replace(/^l\.(\d+) /, 'linha $1: ')}`;
		if (!found.includes(message)) found.push(message);
	}
	return found;
}
