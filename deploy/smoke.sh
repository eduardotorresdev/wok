#!/usr/bin/env bash
# Smoke test pós-deploy. Uso: deploy/smoke.sh [base_url]
# Sem argumento testa o domínio público (ORIGIN do .env). Sai !=0 se algo falhar.
#   SMOKE_EMAIL  destinatário do magic link (padrão: caixa de teste do Resend)
set -u
export PATH="$HOME/.local/bin:$PATH"
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
ENV_FILE="$APP_ROOT/shared/.env"
ORIGIN="$(grep -E '^ORIGIN=' "$ENV_FILE" | cut -d= -f2)"
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
BASE="${1:-$ORIGIN}"
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

magic_link() {
	local body code
	body="$(mktemp)"
	code="$(curl -s -o "$body" -m 30 -w '%{http_code}' -X POST "$BASE/api/auth/sign-in/magic-link" \
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

echo "smoke em $BASE (release $(cat "$APP_ROOT/current/build/REVISION" 2>/dev/null || echo '?'))"
check "app local responde 200 (127.0.0.1:$PORT)" http_is "http://127.0.0.1:$PORT/" 200
check "HTTPS 200 em $BASE/"                      http_is "$BASE/" 200
check "/api/auth respondendo (/api/auth/ok)"     http_is "$BASE/api/auth/ok" 200
check "magic link real via Resend -> $EMAIL"     magic_link
check "Chromium headless abre no servidor"       chromium_opens
check "tectonic compila um .tex"                 tectonic_compiles
exit $fail
