#!/usr/bin/env bash
# Smoke test pós-deploy. Uso: deploy/smoke.sh [base_url]
# Sem argumento testa o domínio público (ORIGIN do .env). Sai !=0 se algo falhar.
#   SMOKE_EMAIL  destinatário do magic link (padrão: caixa de teste do Resend)
set -u
export PATH="$HOME/.local/bin:$HOME/.TinyTeX/bin/x86_64-linux:$PATH"
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
ENV_FILE="$APP_ROOT/shared/.env"
ORIGIN="$(grep -E '^ORIGIN=' "$ENV_FILE" | cut -d= -f2)"
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
BASE="${1:-$ORIGIN}"
LOCAL="http://127.0.0.1:$PORT"
EMAIL="${SMOKE_EMAIL:-delivered@resend.dev}"
fail=0

check() { # nome, comando...
	local name="$1"; shift
	local out
	if out="$("$@" 2>&1)"; then echo "  ok    $name"; else
		echo "  FALHA $name"; echo "$out" | tail -n 5 | sed 's/^/          /'; fail=1
	fi
}

http_is() { # url, código esperado, [args curl...]
	local url="$1" want="$2"; shift 2
	local got; got="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$@" "$url")"
	[ "$got" = "$want" ] || { echo "HTTP $got (esperado $want) em $url"; return 1; }
}

redirects_to_login() { # url
	local got; got="$(curl -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "$1")"
	case "$got" in "303 "*/login*) ;; *) echo "esperado 303 -> /login, veio: $got"; return 1 ;; esac
}

unauthorized_json() { # url: sem sessão deve dar 401 com corpo JSON
	local got; got="$(curl -s -o /dev/null -m 20 -w '%{http_code} %{content_type}' "$1")"
	case "$got" in "401 application/json"*) ;; *) echo "esperado 401 JSON, veio: $got"; return 1 ;; esac
}

magic_link() {
	local body code
	body="$(mktemp)"
	code="$(curl -s -o "$body" -m 30 -w '%{http_code}' -X POST "$LOCAL/api/auth/sign-in/magic-link" \
		-H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
		-d "{\"email\":\"$EMAIL\",\"callbackURL\":\"/\"}")"
	[ "$code" = "200" ] || { echo "HTTP $code: $(head -c 300 "$body")"; rm -f "$body"; return 1; }
	rm -f "$body"
}

chromium_opens() {
	cd "$APP_ROOT/current" && node -e "
		const { chromium } = await import('playwright');
		const b = await chromium.launch({ headless: true });
		const p = await b.newPage();
		await p.goto('data:text/html,<h1>ok</h1>');
		if ((await p.textContent('h1')) !== 'ok') throw new Error('conteúdo inesperado');
		await b.close();
	" --input-type=module
}

tectonic_compiles() {
	local d; d="$(mktemp -d)"
	printf '%s\n' '\documentclass{article}' '\begin{document}' 'WOK smoke: currículo.' '\end{document}' > "$d/s.tex"
	tectonic "$d/s.tex" --outdir "$d" && [ -s "$d/s.pdf" ]
	local rc=$?; rm -rf "$d"; return $rc
}

pdflatex_compiles() { # mínimo com microtype + DisableLigatures (só existe em pdfTeX)
	local d; d="$(mktemp -d)"
	printf '%s\n' '\documentclass{article}' '\usepackage[T1]{fontenc}' '\usepackage[utf8]{inputenc}' \
		'\usepackage{microtype}' '\DisableLigatures{encoding = *, family = *}' \
		'\begin{document}' 'Currículo: ação, experiência, fi fl.' '\end{document}' > "$d/s.tex"
	( cd "$d" && pdflatex -interaction=nonstopmode -halt-on-error s.tex ) && [ -s "$d/s.pdf" ] &&
		pdftotext "$d/s.pdf" - | grep -q 'Currículo: ação, experiência'
	local rc=$?; rm -rf "$d"; return $rc
}

echo "smoke em $BASE (release $(cat "$APP_ROOT/current/build/REVISION" 2>/dev/null || echo '?'))"
# Local: prova o app em si, independente de DNS/túnel.
check "local /api/health 200 ($LOCAL)"            http_is "$LOCAL/api/health" 200
check "local / sem sessão -> 303 /login"          redirects_to_login "$LOCAL/"
for r in onboarding curriculo ajustes; do
	check "local /$r sem sessão -> 303 /login"       redirects_to_login "$LOCAL/$r"
done
check "local /login 200"                          http_is "$LOCAL/login" 200
check "local /login?error=INVALID_TOKEN 200"      http_is "$LOCAL/login?error=INVALID_TOKEN" 200
check "local /api/login-link?token=invalido 200"   http_is "$LOCAL/api/login-link?token=invalido" 200
check "local /api/auth respondendo (/api/auth/ok)" http_is "$LOCAL/api/auth/ok" 200
check "magic link real via Resend -> $EMAIL"      magic_link
check "local /api/jobs/feed sem sessão -> 401 JSON"    unauthorized_json "$LOCAL/api/jobs/feed"
check "local /api/applications sem sessão -> 401 JSON" unauthorized_json "$LOCAL/api/applications"
check "local /api/browser/state sem sessão -> 401 JSON" unauthorized_json "$LOCAL/api/browser/state"
# Público: DNS + túnel + TLS.
check "HTTPS $BASE/ -> 303 /login"                redirects_to_login "$BASE/"
for r in onboarding curriculo ajustes; do
	check "HTTPS /$r sem sessão -> 303 /login"       redirects_to_login "$BASE/$r"
done
check "HTTPS $BASE/login 200"                     http_is "$BASE/login" 200
check "HTTPS /login?error=INVALID_TOKEN 200"      http_is "$BASE/login?error=INVALID_TOKEN" 200
check "HTTPS /api/login-link?token=invalido 200"   http_is "$BASE/api/login-link?token=invalido" 200
check "HTTPS $BASE/api/health 200"                http_is "$BASE/api/health" 200
check "HTTPS $BASE/api/auth/ok 200"               http_is "$BASE/api/auth/ok" 200
check "HTTPS /api/jobs/feed sem sessão -> 401 JSON"    unauthorized_json "$BASE/api/jobs/feed"
check "HTTPS /api/applications sem sessão -> 401 JSON" unauthorized_json "$BASE/api/applications"
check "HTTPS /api/browser/state sem sessão -> 401 JSON" unauthorized_json "$BASE/api/browser/state"
check "Chromium headless abre no servidor"       chromium_opens
check "tectonic compila um .tex"                 tectonic_compiles
check "pdflatex --version"                        pdflatex --version
check "pdflatex compila microtype + DisableLigatures" pdflatex_compiles
check "tlmgr utilizável pelo usuário do serviço"  test -w "$HOME/.TinyTeX" -a -x "$HOME/.TinyTeX/bin/x86_64-linux/tlmgr"
exit $fail
