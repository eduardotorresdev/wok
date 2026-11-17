#!/usr/bin/env bash
# Backup simples do DATA_DIR (SQLite + arquivos). Mantém os 14 mais recentes.
# Bancos SQLite são copiados com `.backup` (consistente com o app rodando) quando o
# CLI sqlite3 existe; o resto do diretório vai num tar.
set -euo pipefail
APP_ROOT="${WOK_ROOT:-$HOME/wok}"
DATA_DIR="$(grep -E '^DATA_DIR=' "$APP_ROOT/shared/.env" | cut -d= -f2)"
DEST="${WOK_BACKUP_DIR:-$HOME/wok-backups}"
KEEP="${WOK_KEEP_BACKUPS:-14}"

[ -d "$DATA_DIR" ] && [ -n "$(ls -A "$DATA_DIR")" ] || { echo "backup: DATA_DIR vazio, nada a fazer"; exit 0; }

STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$DEST" "$WORK/data"

cp -a "$DATA_DIR/." "$WORK/data/"
if command -v sqlite3 >/dev/null; then
	( cd "$DATA_DIR" && find . -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) ) |
		while read -r db; do
			rm -f "$WORK/data/$db" "$WORK/data/$db-wal" "$WORK/data/$db-shm"
			sqlite3 "$DATA_DIR/$db" ".backup '$WORK/data/$db'"
		done
fi

umask 077
tar -czf "$DEST/wok-data-$STAMP.tar.gz" -C "$WORK" data
ls -1t "$DEST"/wok-data-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup: $DEST/wok-data-$STAMP.tar.gz"
