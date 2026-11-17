import { Resend } from 'resend';
import { config } from './env';

export async function sendMagicLinkEmail(email: string, url: string) {
	if (!config.resendApiKey) {
		// Local development without Resend: the link is the only way in.
		console.log(`[auth] magic link for ${email}: ${url}`);
		return;
	}
	const resend = new Resend(config.resendApiKey);
	const { error } = await resend.emails.send({
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
	if (error) {
		console.error('[auth] resend error', error);
		throw new Error(`Falha ao enviar email: ${error.message}`);
	}
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
	const resend = new Resend(config.resendApiKey);
	const { error } = await resend.emails.send({
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
	if (error) throw new Error(`Falha ao enviar email: ${error.message}`);
}
