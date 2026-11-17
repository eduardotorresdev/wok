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
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" | cut -d= -f2)"
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

# Segurança: o LaTeX enviado por um usuário não pode ler arquivos do servidor. Entra como a
# conta do smoke ($EMAIL, que acabou de pedir um magic link) e manda compilar um .tex que
# faz \input de /etc/hostname e de um arquivo-canário criado ao lado do .env. Falha se o
# hostname ou o canário aparecerem no texto do PDF ou na resposta, ou se o log do TeX
# mostrar que abriu algum dos dois.
latex_cannot_read_host_files() {
	local jar body pdf tok host canary cfile code cookie rc=0 f
	jar="$(mktemp)"; body="$(mktemp)"; pdf="$(mktemp)"; host="$(hostname)"
	canary="WOKCANARY$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
	cfile="$APP_ROOT/shared/smoke-canary.txt"
	( umask 077; echo "$canary" > "$cfile" )
	tok="$(cd "$APP_ROOT/current" && DB="$DATA_DIR/wok.db" EMAIL="$EMAIL" node -e "
		const db = new (require('better-sqlite3'))(process.env.DB, { readonly: true });
		const r = db.prepare(\"select identifier from verification where identifier like 'magic-link:%' and value like '%' || ? || '%' order by rowid desc limit 1\").get(process.env.EMAIL);
		if (!r) process.exit(1);
		console.log(r.identifier.split(':')[1]);
	")" || { echo "sem token de login para $EMAIL"; rm -f "$jar" "$body" "$pdf" "$cfile"; return 1; }
	# Tudo por 127.0.0.1, para não depender da rede/túnel. O cookie de sessão é Secure e o
	# curl não o reenviaria por http, então vai num cabeçalho Cookie montado a partir do jar.
	curl -s -o /dev/null -m 30 -c "$jar" -H "Origin: $ORIGIN" "$LOCAL/api/auth/magic-link/verify?token=$tok&callbackURL=%2F"
	cookie="$(awk -F'\t' 'NF >= 7 { sub(/^#HttpOnly_/, "", $1); printf "%s=%s; ", $6, $7 }' "$jar")"
	[ -n "$cookie" ] || { echo "inconclusivo: login da conta do smoke não devolveu cookie"; rm -f "$jar" "$body" "$pdf" "$cfile"; return 1; }
	for f in /etc/hostname "$cfile"; do
		code="$(curl -s -o "$body" -m 200 -w '%{http_code}' -H "Cookie: $cookie" -X POST "$LOCAL/api/resume/compile" \
			-H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
			-d "{\"latex\":\"\\\\documentclass{article}\\\\begin{document}smoke-leak-test \\\\input{$f} fim\\\\end{document}\"}")"
		if [ "$code" != "200" ] || ! grep -q '"ok"' "$body"; then
			echo "inconclusivo ($f): HTTP $code: $(head -c 200 "$body")"; rc=1; continue
		fi
		: > "$pdf"
		curl -s -o "$pdf" -m 60 -H "Cookie: $cookie" "$LOCAL/api/resume/pdf" || true
		if grep -qF -e "$host" -e "$canary" "$body" ||
			pdftotext "$pdf" - 2>/dev/null | grep -qF -e "$host" -e "$canary"; then
			echo "VAZOU: conteúdo de $f voltou no PDF ou na resposta da compilação"; rc=1
		elif grep -qF "($f" "$body"; then
			echo "VAZOU: o log do TeX mostra que $f foi aberto"; rc=1
		fi
	done
	rm -f "$jar" "$body" "$pdf" "$cfile"; return $rc
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
check "LaTeX de usuário não lê arquivos do servidor" latex_cannot_read_host_files
check "bwrap disponível para o usuário do serviço" bwrap --unshare-all --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib --ro-bind /lib64 /lib64 /bin/true
check "Chromium headless abre no servidor"       chromium_opens
check "tectonic compila um .tex"                 tectonic_compiles
check "pdflatex --version"                        pdflatex --version
check "pdflatex compila microtype + DisableLigatures" pdflatex_compiles
check "tlmgr utilizável pelo usuário do serviço"  test -w "$HOME/.TinyTeX" -a -x "$HOME/.TinyTeX/bin/x86_64-linux/tlmgr"
exit $fail
