#!/usr/bin/env bash
# Build the app and start or update the live stack, with a database backup first and an automatic
# rollback if the new version does not come up healthy.
#
#   ./build_and_update.sh           build from this folder and update
#   ./build_and_update.sh --pull    git pull first
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

docker compose version >/dev/null 2>&1 || die "Docker with the compose plugin (v2) is required."

if [[ "${1:-}" == "--pull" ]]; then
	say "Pulling the latest code"
	git pull --ff-only
fi

# First run: settings with random passwords. An existing database keeps the password it was made with.
if [[ ! -f .env ]]; then
	project="$(docker compose config --format json | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -1)"
	if docker volume inspect "${project}_pgdata" >/dev/null 2>&1; then
		db_pass=carcass
		say "Found an existing database: keeping its password in .env (change it in Postgres first if you want another)."
	else
		db_pass="$(openssl rand -hex 16)"
	fi
	admin_pass="$(openssl rand -base64 12 | tr -d '/+=')"
	sed -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_pass/" -e "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$admin_pass/" .env.example > .env
	chmod 600 .env
	say "Created .env. On a new install, sign in as cm with $admin_pass (both in .env); an existing account keeps its password."
fi

set -a; source .env; set +a
image="${IMAGE:-forgotten-letters}"
tag="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"

# Keep the running version so a failed update can go back to it.
if docker image inspect $image:latest >/dev/null 2>&1; then
	docker tag $image:latest $image:previous
fi

say "Building $image:$tag"
TAG="$tag" docker compose build --pull carcass-front
docker tag "$image:$tag" $image:latest

# Back up the database before migrations run.
if [[ -n "$(docker compose ps -q --status running db 2>/dev/null)" ]]; then
	mkdir -p backups
	file="backups/$(date +%Y%m%d-%H%M%S)-$tag.dump"
	say "Backing up the database to $file"
	docker compose exec -T db pg_dump -U carcass -Fc carcass > "$file"
	ls -1t backups/*.dump | tail -n +11 | xargs -r rm --
fi

# The app runs as the unprivileged `node` user; hand it the data volume (older versions ran as root).
docker compose run --rm --no-deps --user root --entrypoint chown carcass-front -R node:node /data

say "Starting"
if ! docker compose up -d --wait --wait-timeout 180; then
	docker compose logs --tail 60 carcass-front || true
	if docker image inspect $image:previous >/dev/null 2>&1; then
		say "The new version did not come up healthy: rolling back to the previous one."
		docker tag $image:previous $image:latest
		docker compose up -d --wait --wait-timeout 180 || true
	fi
	die "Update failed (logs above). The database backup is in backups/."
fi

docker image prune -f >/dev/null
say "Up to date ($tag): http://localhost:${PORT:-3000}${DOMAIN:+  and  https://$DOMAIN}"
