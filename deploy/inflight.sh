#!/usr/bin/env bash
# Mostra trabalho em andamento que um restart interromperia: application em
# tailoring/applying e search_run em running. Sai 0 se não há nada, 1 se há.
# Usa o better-sqlite3 da release ativa (a máquina não tem o CLI sqlite3).
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
DATA_DIR="$(grep -E '^DATA_DIR=' "$APP_ROOT/shared/.env" | cut -d= -f2)"
DB="$DATA_DIR/wok.db"
[ -f "$DB" ] && [ -d "$APP_ROOT/current/node_modules/better-sqlite3" ] || { echo "em andamento: nada (sem banco)"; exit 0; }
cd "$APP_ROOT/current"
DB="$DB" node -e "
	const db = new (require('better-sqlite3'))(process.env.DB, { readonly: true, fileMustExist: true });
	const has = (t) => !!db.prepare(\"select 1 from sqlite_master where type='table' and name=?\").get(t);
	const n = (t, where) => (has(t) ? db.prepare('select count(*) c from ' + t + ' where ' + where).get().c : 0);
	const apps = n('application', \"status in ('tailoring','applying')\");
	const runs = n('search_run', \"status = 'running'\");
	console.log('em andamento: ' + apps + ' inscrição(ões) em tailoring/applying, ' + runs + ' busca(s) running');
	process.exit(apps + runs > 0 ? 1 : 0);
"
