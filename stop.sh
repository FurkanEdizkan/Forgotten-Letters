#!/usr/bin/env bash
# Stop the live stack safely: back up the database, then stop every container cleanly.
# Data (database, uploads, certificates) stays in its volumes; nothing is deleted.
#
#   ./stop.sh               back up, then stop
#   ./stop.sh --no-backup   stop without a backup
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\033[1m%s\033[0m\n' "$*"; }

if [[ "${1:-}" != "--no-backup" && -n "$(docker compose ps -q --status running db 2>/dev/null)" ]]; then
	mkdir -p backups
	file="backups/$(date +%Y%m%d-%H%M%S)-stop.dump"
	say "Backing up the database to $file"
	docker compose exec -T db pg_dump -U carcass -Fc carcass > "$file"
	ls -1t backups/*.dump | tail -n +11 | xargs -r rm --
fi

say "Stopping"
# Never `down -v`: that would delete the database and uploads.
docker compose down
say "Stopped. Your data is kept. Start again with ./build_and_update.sh (or: docker compose up -d)."
