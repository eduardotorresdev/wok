import { apiError } from '#lib/server/http.ts';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The emailed link lands here instead of on the verify endpoint. Mail scanners
// and link previews open every URL in a message; if that GET consumed the
// single-use token, the person's own tap would fail. Only the button below
// reaches the endpoint that spends the token. A used or expired link ends on
// /login?error=INVALID_TOKEN|EXPIRED_TOKEN, which the login page explains.
export const GET = ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const requested = url.searchParams.get('callbackURL') ?? '/';
	if (!/^[A-Za-z0-9_-]{8,200}$/.test(token)) {
		return apiError(400, 'invalid_token', 'Link de acesso inválido.');
	}
	// Same-site paths only, so the link cannot be used to bounce people elsewhere.
	const callback = /^\/(?![/\\])/.test(requested) ? requested : '/';
	const verify = `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callback)}&errorCallbackURL=${encodeURIComponent('/login')}`;

	return new Response(
		`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Entrar no WOK</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&family=Instrument+Serif&display=swap">
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:Figtree,system-ui,sans-serif;background:#fff;color:#221b2b;-webkit-font-smoothing:antialiased}
main{max-width:22rem;padding:2rem 1.5rem}
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:2.5rem;line-height:1.1;margin:0 0 .75rem}
p{margin:0 0 1.75rem;line-height:1.5;color:#5f5868}
a{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;background:#221b2b;color:#fff;text-decoration:none;font-weight:600;padding:.75rem 1rem;border-radius:8px}
a:focus-visible{outline:2px solid #7446c4;outline-offset:2px}
</style>
</head>
<body>
<main>
<h1>Entrar no WOK</h1>
<p>Toque no botão para concluir o acesso neste aparelho.</p>
<a href="${escapeHtml(verify)}" rel="nofollow">Entrar</a>
</main>
</body>
</html>`,
		{
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'no-store',
				'referrer-policy': 'no-referrer'
			}
		}
	);
};
