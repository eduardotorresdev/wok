import type { ApplicationStatus, Job } from './types.ts';

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
