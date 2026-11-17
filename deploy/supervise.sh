#!/usr/bin/env bash
# Supervisor do processo Node do WOK. Mantém `node build` da release apontada por
# $APP_ROOT/current rodando: reinicia se o processo morrer e quando o symlink `current`
# mudar (é assim que deploy.sh "reinicia", sem depender de systemctl nem de PID).
# Forçar restart manual: touch $APP_ROOT/restart
set -u
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_ENV=production
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
child=""

stop_child() {
	[ -n "$child" ] || return 0
	kill -TERM "$child" 2>/dev/null
	for _ in $(seq 1 70); do kill -0 "$child" 2>/dev/null || break; sleep 0.5; done
	kill -KILL "$child" 2>/dev/null
	wait "$child" 2>/dev/null
}
trap 'stop_child; exit 0' TERM INT

while true; do
	rel="$(readlink -f "$APP_ROOT/current")"
	if [ ! -f "$rel/build/index.js" ]; then
		echo "[supervise] sem release válida em $APP_ROOT/current; aguardando"
		sleep 5
		continue
	fi
	cd "$rel" || exit 1
	echo "[supervise] iniciando $rel"
	node --env-file="$APP_ROOT/shared/.env" build &
	child=$!
	echo "$rel" > "$APP_ROOT/running-release"

	while kill -0 "$child" 2>/dev/null; do
		sleep 2
		if [ "$(readlink -f "$APP_ROOT/current")" != "$rel" ] || [ -e "$APP_ROOT/restart" ]; then
			rm -f "$APP_ROOT/restart"
			echo "[supervise] nova release ou restart pedido; reiniciando"
			stop_child
			break
		fi
	done
	wait "$child" 2>/dev/null
	echo "[supervise] processo saiu (status $?)"
	sleep 1
done
