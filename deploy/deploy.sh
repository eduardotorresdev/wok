#!/usr/bin/env bash
# Deploy de um comando: deploy/deploy.sh [ref]   (ref padrão: pilot)
# Roda NA própria máquina de produção (o repo vive aqui). Passos:
#   git archive do ref -> install -> build (adapter-node) -> backup -> troca do symlink
#   -> o supervisor reinicia o processo -> health check (rollback se falhar) -> smoke test.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${WOK_REPO:-$(cd "$HERE/.." && pwd)}"
REF="${1:-pilot}"
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
KEEP="${WOK_KEEP_RELEASES:-5}"
ENV_FILE="$APP_ROOT/shared/.env"

[ -f "$ENV_FILE" ] || { echo "falta $ENV_FILE (veja deploy/env.example)"; exit 1; }
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" | cut -d= -f2)"

SHA="$(git -C "$REPO" rev-parse --short "$REF")"
REL="$APP_ROOT/releases/$(date +%Y%m%d-%H%M%S)-$SHA"
PREV="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
echo "==> release $REL (ref $REF @ $SHA)"

mkdir -p "$REL" "$APP_ROOT/bin" "$DATA_DIR"
git -C "$REPO" archive "$REF" | tar -x -C "$REL"
cd "$REL"

echo "==> install"
pnpm install --frozen-lockfile

# Enquanto o repo não usar adapter-node, aplica só na release (nunca no repo).
CFGS=()
for f in vite.config.ts svelte.config.js; do [ -f "$f" ] && CFGS+=("$f"); done
if ! grep -qs "adapter-node" "${CFGS[@]}"; then
	echo "==> adapter-node ausente no ref; aplicando shim na release"
	pnpm add -D @sveltejs/adapter-node
	sed -i 's#@sveltejs/adapter-auto#@sveltejs/adapter-node#' "${CFGS[@]}"
fi

echo "==> chromium do playwright"
pnpm exec playwright install chromium

echo "==> build"
# Variáveis do servidor disponíveis no build ($env/static/*), sem vazar para o log.
set -a; . "$ENV_FILE"; set +a
pnpm build
[ -f build/index.js ] || { echo "build/index.js não gerado (adapter-node?)"; exit 1; }
echo "$SHA" > build/REVISION

echo "==> backup"
"$HERE/backup.sh" || echo "aviso: backup falhou"

echo "==> ativando"
install -m 755 "$HERE/supervise.sh" "$HERE/backup.sh" "$APP_ROOT/bin/"
ln -sfn "$REL" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"

healthy() {
	for _ in $(seq 1 45); do
		if [ "$(cat "$APP_ROOT/running-release" 2>/dev/null)" = "$1" ] &&
			curl -fsS -o /dev/null -m 5 "http://127.0.0.1:$PORT/"; then return 0; fi
		sleep 2
	done
	return 1
}

if ! healthy "$REL"; then
	echo "!! release não ficou saudável em 90s"
	if [ -n "$PREV" ] && [ -d "$PREV" ]; then
		echo "!! rollback para $PREV"
		ln -sfn "$PREV" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"
	fi
	echo "   (o supervisor está rodando? veja deploy/README.md)"
	exit 1
fi
echo "==> no ar: $SHA em 127.0.0.1:$PORT"

# Mantém as $KEEP releases mais recentes.
ls -1dt "$APP_ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "==> smoke"
"$HERE/smoke.sh" || { echo "!! smoke test com falhas (deploy mantido)"; exit 2; }
