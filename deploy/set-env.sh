#!/usr/bin/env bash
# Troca uma variável do .env de produção e reinicia o app. O valor nunca vai na linha de
# comando (ficaria no histórico e no ps): vem do stdin, ou é gerado com --generate.
#   deploy/set-env.sh BETTER_AUTH_SECRET --generate     # rotação do segredo de sessão
#   deploy/set-env.sh ANTHROPIC_API_KEY                 # cola o valor e Enter (ou via pipe)
#   WOK_NO_RESTART=1 deploy/set-env.sh RESEND_API_KEY   # várias trocas, um restart no fim
# Rotacionar BETTER_AUTH_SECRET invalida todas as sessões e magic links pendentes: todo
# mundo entra de novo. Guarda o .env anterior em ~/wok/shared/.env.bak-<data> (chmod 600);
# apague o backup depois de confirmar, porque ele contém o segredo antigo.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
ENV_FILE="$APP_ROOT/shared/.env"
KEY="${1:?uso: set-env.sh NOME [--generate]}"
[[ "$KEY" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "nome inválido: $KEY"; exit 1; }

if [ "${2:-}" = "--generate" ]; then
	VALUE="$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48)"
else
	[ -t 0 ] && printf 'valor de %s (não aparece): ' "$KEY" >&2
	IFS= read -rs VALUE; [ -t 0 ] && echo >&2
fi
[ -n "$VALUE" ] || { echo "valor vazio; nada alterado"; exit 1; }

umask 077
cp -p "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp "$ENV_FILE.XXXXXX")"
grep -v -E "^${KEY}=" "$ENV_FILE" > "$TMP" || true
printf '%s=%s\n' "$KEY" "$VALUE" >> "$TMP"
chmod 600 "$TMP"; mv "$TMP" "$ENV_FILE"
echo "$KEY atualizado em $ENV_FILE (${#VALUE} caracteres)"

if [ "${WOK_NO_RESTART:-0}" = "1" ]; then echo "sem restart (WOK_NO_RESTART=1); aplicar: touch $APP_ROOT/restart"; exit 0; fi
"$HERE/inflight.sh" || { echo "há trabalho em andamento; NÃO reiniciei. Quando terminar: touch $APP_ROOT/restart"; exit 3; }
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
touch "$APP_ROOT/restart"
sleep 5
for _ in $(seq 1 180); do
	curl -fs -o /dev/null -m 5 "http://127.0.0.1:$PORT/api/health" && { echo "app de volta"; exit 0; }
	sleep 2
done
echo "!! app não voltou em 6 min; .env anterior está no backup"; exit 1
