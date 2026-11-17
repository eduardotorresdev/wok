import { Resend } from 'resend';
import { config } from './env';
import { withRetry, withTimeout } from './retry.ts';

/** The email service could not be reached after every attempt (never a refused request). */
export class EmailUnavailable extends Error {}

class SendFailed extends Error {
	constructor(
		message: string,
		readonly statusCode: number | null
	) {
		super(message);
	}
}

const SEND_TIMEOUT_MS = 10_000;

type Message = { from: string; to: string; subject: string; text: string; html: string };

/**
 * Sends one email, trying again when the service could not be reached or
 * answered 5xx. A 4xx (bad address, bad key) is final at the first answer.
 */
async function deliver(message: Message) {
	const resend = new Resend(config.resendApiKey);
	try {
		await withRetry(
			'email',
			async () => {
				const { error } = await withTimeout(resend.emails.send(message), SEND_TIMEOUT_MS, 'email');
				// The SDK reports a failed fetch as an error without a status code.
				// A refusal whose body carries no status is still a refusal: only the SDK's
				// own "could not fetch" error counts as the network.
				if (error) {
					const unreachable = error.statusCode == null && error.name === 'application_error';
					throw new SendFailed(error.message, unreachable ? null : (error.statusCode ?? 400));
				}
			},
			{
				retryable: (err) =>
					err instanceof SendFailed ? err.statusCode === null || err.statusCode >= 500 : true
			}
		);
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		console.error('[email] send failed', reason);
		if (err instanceof SendFailed && err.statusCode !== null && err.statusCode < 500) {
			throw new Error(`Falha ao enviar email: ${reason}`, { cause: err });
		}
		throw new EmailUnavailable(`Falha ao enviar email: ${reason}`, { cause: err });
	}
}

export async function sendMagicLinkEmail(email: string, url: string) {
	if (!config.resendApiKey) {
		// Local development without Resend: the link is the only way in.
		console.log(`[auth] magic link for ${email}: ${url}`);
		return;
	}
	await deliver({
		from: config.emailFrom,
		to: email,
		subject: 'Seu link de acesso ao WOK',
		text: `Olá!\n\nUse o link abaixo para entrar no WOK. Ele vale por 15 minutos e só pode ser usado uma vez.\n\n${url}\n\nSe você não pediu este acesso, ignore este email.`,
		html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#221b2b">
<h1 style="font-size:22px;margin:0 0 12px">Entrar no WOK</h1>
<p style="font-size:15px;line-height:1.5">Toque no botão para acessar sua conta. O link vale por 15 minutos e só pode ser usado uma vez.</p>
<p style="margin:24px 0"><a href="${url}" style="background:#221b2b;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:600;display:inline-block">Entrar</a></p>
<p style="font-size:13px;color:#5f5868">Se você não pediu este acesso, ignore este email.</p>
</div>`
	});
}

const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tells the person that an application stopped and is waiting for them. */
export async function sendNeedsUserEmail(
	email: string,
	info: { company: string; title: string; reason: string; url: string }
) {
	const subject = `Sua inscrição na ${info.company} precisa de você`;
	if (!config.resendApiKey) {
		console.log(`[notify] ${email}: ${subject} — ${info.url}`);
		return;
	}
	await deliver({
		from: config.emailFrom,
		to: email,
		subject,
		text: `A inscrição para ${info.title} na ${info.company} está parada esperando você.\n\n${info.reason}\n\nAbrir a inscrição: ${info.url}\n\nPara não receber estes avisos, desligue-os no seu perfil no WOK.`,
		html: `<div style="font-family:Figtree,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#221b2b">
<h1 style="font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;margin:0 0 12px">Sua inscrição precisa de você</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 12px"><strong>${escapeHtml(info.title)}</strong> na ${escapeHtml(info.company)}</p>
<p style="font-size:15px;line-height:1.5;margin:0">${escapeHtml(info.reason)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(info.url)}" style="background:#221b2b;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:600;display:inline-block">Abrir a inscrição</a></p>
<p style="font-size:13px;color:#5f5868">Para não receber estes avisos, desligue-os no seu perfil no WOK.</p>
</div>`
	});
}
