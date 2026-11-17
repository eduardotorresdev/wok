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
		html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1530">
<h1 style="font-size:22px;margin:0 0 12px">Entrar no WOK</h1>
<p style="font-size:15px;line-height:1.5">Toque no botão para acessar sua conta. O link vale por 15 minutos e só pode ser usado uma vez.</p>
<p style="margin:24px 0"><a href="${url}" style="background:#5b2bd9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Entrar</a></p>
<p style="font-size:13px;color:#6b6480">Se você não pediu este acesso, ignore este email.</p>
</div>`
	});
	if (error) {
		console.error('[auth] resend error', error);
		throw new Error(`Falha ao enviar email: ${error.message}`);
	}
}
