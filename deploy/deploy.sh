#!/usr/bin/env bash
# Deploy de um comando: deploy/deploy.sh [ref]   (ref padrão: pilot)
# Roda NA própria máquina de produção (o repo vive aqui). Passos:
#   git archive do ref -> install -> build (adapter-node), tudo sem tocar na produção
#   -> espera não haver trabalho em andamento e a máquina estar folgada -> backup
#   -> troca do symlink -> o supervisor reinicia o processo -> health check (rollback se
#   falhar) -> smoke test.
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

PREV="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"

# Duas fases. O build nunca toca na versão em produção; só a ativação reinicia.
#   WOK_BUILD_ONLY=1         constrói e para (imprime o caminho da release)
#   WOK_RELEASE=<diretório>  ativa uma release já construída, sem rebuild
if [ -n "${WOK_RELEASE:-}" ]; then
	REL="$(readlink -f "$WOK_RELEASE")"
	[ -f "$REL/build/index.js" ] || { echo "release sem build: $REL"; exit 1; }
	SHA="$(cat "$REL/build/REVISION")"
	echo "==> ativando release já construída $REL ($SHA)"
else
	SHA="$(git -C "$REPO" rev-parse --short "$REF")"
	REL="$APP_ROOT/releases/$(date +%Y%m%d-%H%M%S)-$SHA"
	echo "==> release $REL (ref $REF @ $SHA)"

	mkdir -p "$REL" "$APP_ROOT/bin" "$DATA_DIR"
	git -C "$REPO" archive "$REF" | tar -x -C "$REL"
	cd "$REL"

	# Install e build rodam com prioridade baixa de CPU/disco e teto de memória, para não
	# disputar com o processo de produção na mesma máquina.
	LOW=(nice -n 15)
	command -v ionice >/dev/null && LOW+=(ionice -c 3)
	BUILD_HEAP_MB="${WOK_BUILD_HEAP_MB:-1536}"

	echo "==> install"
	"${LOW[@]}" pnpm install --frozen-lockfile

	# Enquanto o repo não usar adapter-node, aplica só na release (nunca no repo).
	CFGS=()
	for f in vite.config.ts svelte.config.js; do [ -f "$f" ] && CFGS+=("$f"); done
	if ! grep -qs "adapter-node" "${CFGS[@]}"; then
		echo "==> adapter-node ausente no ref; aplicando shim na release"
		"${LOW[@]}" pnpm add -D @sveltejs/adapter-node
		sed -i 's#@sveltejs/adapter-auto#@sveltejs/adapter-node#' "${CFGS[@]}"
	fi

	echo "==> chromium do playwright"
	"${LOW[@]}" pnpm exec playwright install chromium

	echo "==> build"
	# Variáveis do servidor disponíveis no build ($env/static/*), sem vazar para o log.
	set -a; . "$ENV_FILE"; set +a
	NODE_OPTIONS="--max-old-space-size=$BUILD_HEAP_MB" "${LOW[@]}" pnpm build
	[ -f build/index.js ] || { echo "build/index.js não gerado (adapter-node?)"; exit 1; }
	echo "$SHA" > build/REVISION

fi

if [ "${WOK_BUILD_ONLY:-0}" = "1" ]; then
	echo "==> build pronto, NÃO ativado: $REL"
	echo "    ativar: WOK_RELEASE=$REL deploy/deploy.sh"
	exit 0
fi

# Restart com a máquina sobrecarregada já deixou o site minutos fora (Node sem conseguir
# abrir a porta). Só reinicia com load de 1 min < WOK_MAX_LOAD e memória disponível
# > WOK_MIN_AVAIL_MB; espera até WOK_WAIT_HOST s e desiste (código 4). WOK_FORCE=1 ignora.
host_ok() {
	local load avail
	load="$(cut -d' ' -f1 /proc/loadavg)"
	avail="$(awk '/^MemAvailable:/ {print int($2 / 1024)}' /proc/meminfo)"
	echo "   load 1min $load (máx ${WOK_MAX_LOAD:-8}), memória disponível ${avail} MB (mín ${WOK_MIN_AVAIL_MB:-2000})"
	awk -v l="$load" -v m="${WOK_MAX_LOAD:-8}" 'BEGIN { exit !(l < m) }' && [ "$avail" -ge "${WOK_MIN_AVAIL_MB:-2000}" ]
}
echo "==> carga da máquina"
waited=0
until host_ok; do
	if [ "${WOK_FORCE:-0}" = "1" ]; then echo "   WOK_FORCE=1: seguindo mesmo assim"; break; fi
	if [ "$waited" -ge "${WOK_WAIT_HOST:-600}" ]; then
		echo "!! máquina sobrecarregada após ${waited}s; deploy NÃO ativado (release pronta em $REL)"
		echo "    ativar depois: WOK_RELEASE=$REL deploy/deploy.sh"
		exit 4
	fi
	sleep 30; waited=$((waited + 30))
done

# Restart interrompe busca (vira failed) e inscrição em andamento (volta para a fila).
# Espera terminar; WOK_WAIT_INFLIGHT=segundos (padrão 900), WOK_FORCE=1 ignora.
echo "==> trabalho em andamento"
waited=0
until "$HERE/inflight.sh"; do
	if [ "${WOK_FORCE:-0}" = "1" ]; then echo "   WOK_FORCE=1: seguindo mesmo assim"; break; fi
	if [ "$waited" -ge "${WOK_WAIT_INFLIGHT:-900}" ]; then
		echo "!! ainda há trabalho em andamento após ${waited}s; deploy NÃO ativado (release pronta em $REL)"
		exit 3
	fi
	sleep 15; waited=$((waited + 15))
done

# Alguém usando o browser remoto (ex.: login do LinkedIn em "Conectar contas") seria
# expulso pelo restart. Espera 2 min de inatividade por até WOK_WAIT_BROWSER s (padrão 300)
# e então segue mesmo assim, deixando o aviso no log.
echo "==> browser remoto em uso"
waited=0
BROWSER_INTERRUPTED=0
while n="$("$HERE/browser-active.sh")"; [ "${n:-0}" -gt 0 ]; do
	echo "   $n sessão(ões) com atividade nos últimos 120 s"
	if [ "${WOK_FORCE:-0}" = "1" ] || [ "$waited" -ge "${WOK_WAIT_BROWSER:-300}" ]; then
		echo "!! AVISO: reiniciando com $n sessão(ões) de browser ativa(s) após ${waited}s de espera"
		BROWSER_INTERRUPTED="$n"
		break
	fi
	sleep 15; waited=$((waited + 15))
done
[ "$BROWSER_INTERRUPTED" = "0" ] && echo "   nenhuma sessão ativa"

echo "==> backup"
"$HERE/backup.sh" || echo "aviso: backup falhou"

echo "==> ativando"
install -m 755 "$HERE/supervise.sh" "$HERE/backup.sh" "$APP_ROOT/bin/"
ln -sfn "$REL" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"

# Com a máquina carregada o Node já levou minutos para abrir a porta.
HEALTH_TRIES="${WOK_HEALTH_TRIES:-180}" # x2s
healthy() {
	for _ in $(seq 1 "$HEALTH_TRIES"); do
		if [ "$(cat "$APP_ROOT/running-release" 2>/dev/null)" = "$1" ] &&
			curl -fs -o /dev/null -m 5 "http://127.0.0.1:$PORT/api/health"; then return 0; fi
		sleep 2
	done
	return 1
}

if ! healthy "$REL"; then
	echo "!! release não ficou saudável em $((HEALTH_TRIES * 2))s"
	if [ -n "$PREV" ] && [ -d "$PREV" ]; then
		echo "!! rollback para $PREV"
		ln -sfn "$PREV" "$APP_ROOT/current.tmp" && mv -T "$APP_ROOT/current.tmp" "$APP_ROOT/current"
	fi
	echo "   (o supervisor está rodando? veja deploy/README.md)"
	exit 1
fi
echo "==> no ar: $SHA em 127.0.0.1:$PORT"

# Mantém as $KEEP releases mais recentes.
ls -1dt "$APP_ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | grep -vF "$REL/" | xargs -r rm -rf

echo "==> smoke"
"$HERE/smoke.sh" || { echo "!! smoke test com falhas (deploy mantido)"; exit 2; }
