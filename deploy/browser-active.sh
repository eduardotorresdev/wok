#!/usr/bin/env bash
# Imprime quantas sessões do browser remoto estão sob controle de um usuário com atividade
# nos últimos 120 s (tabela browser_user_session). Um restart expulsaria essa pessoa, por
# exemplo no meio do login do LinkedIn em "Conectar contas". Sem banco ou sem a tabela: 0.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
DATA_DIR="$(grep -E '^DATA_DIR=' "$APP_ROOT/shared/.env" | cut -d= -f2)"
DB="$DATA_DIR/wok.db"
[ -f "$DB" ] && [ -d "$APP_ROOT/current/node_modules/better-sqlite3" ] || { echo 0; exit 0; }
cd "$APP_ROOT/current"
DB="$DB" node -e "
	const db = new (require('better-sqlite3'))(process.env.DB, { readonly: true, fileMustExist: true });
	const has = db.prepare(\"select 1 from sqlite_master where type='table' and name='browser_user_session'\").get();
	const n = has
		? db.prepare(\"select count(*) c from browser_user_session where last_activity > (cast(strftime('%s','now') as integer) - 120) * 1000\").get().c
		: 0;
	console.log(n);
"
