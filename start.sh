#!/bin/sh
# Start Forgotten Letters with Docker: pick a free host port, write it into .env, then `docker compose up -d`.
#
#   ./start.sh            start (or restart) the app
#   ./start.sh --build    any extra arguments go to `docker compose up -d`
#
# - No .env yet: it is made from .env.example with a new random database password (never printed).
# - The ports tried are PORTS in .env (default 3000,3001,3002,3003,3004,3005). A saved APP_PORT is kept while it is
#   free, or while this app's own container publishes it. Otherwise the first free port of PORTS is written to
#   APP_PORT (a bind address such as 127.0.0.1: is kept), and an http ORIGIN on the old port follows it.
# - Every port taken: a warning naming each port, exit 1, Docker not started.
# - FL_WAIT_SECONDS: how long to wait for /health/ready (default 120; 0 skips the wait).
# Nothing from .env is printed except the lines this script changes. Windows: start.ps1 does the same.
set -eu

cd "$(dirname "$0")"

DEFAULT_PORTS=3000,3001,3002,3003,3004,3005
CONTAINER_PORT=3000

say() { printf '%s\n' "$*"; }
fail() {
	printf '%s\n' "$*" >&2
	exit 1
}
have() { command -v "$1" >/dev/null 2>&1; }

# The last uncommented KEY=value line of .env, without quotes or a trailing CR; empty when unset.
env_get() {
	sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env | tail -n 1 | tr -d '\r' |
		sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" -e 's/[[:space:]]*$//'
}

# Set KEY=value in .env: replace every uncommented KEY= line, or append one. The file keeps its mode and owner.
env_set() {
	tmp=$(mktemp "${TMPDIR:-/tmp}/fl-env.XXXXXX")
	KEY="$1" VALUE="$2" awk '
		BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VALUE"]; done = 0 }
		$0 ~ "^[[:space:]]*" k "[[:space:]]*=" { print k "=" v; done = 1; next }
		{ print }
		END { if (!done) print k "=" v }
	' .env >"$tmp"
	cat "$tmp" >.env
	rm -f "$tmp"
}

random_password() {
	if have openssl; then
		openssl rand -hex 24
	else
		od -An -tx1 -N24 /dev/urandom | tr -d ' \n'
	fi
}

# 1. .env: made from .env.example with a generated database password when missing.
if [ ! -f .env ]; then
	[ -f .env.example ] || fail "No .env and no .env.example next to start.sh. Copy .env.example from the release."
	old_umask=$(umask)
	umask 077
	PW=$(random_password) awk '
		BEGIN { pw = ENVIRON["PW"]; done = 0 }
		!done && /^[[:space:]]*POSTGRES_PASSWORD[[:space:]]*=/ { print "POSTGRES_PASSWORD=" pw; done = 1; next }
		{ print }
		END { if (!done) print "POSTGRES_PASSWORD=" pw }
	' .env.example >.env
	umask "$old_umask"
	chmod 600 .env
	say "No .env yet: created it from .env.example with a new database password (not shown)."
fi

# 2. The port list.
ports_raw=$(env_get PORTS)
[ -n "$ports_raw" ] || ports_raw=$DEFAULT_PORTS
PORTS=""
for p in $(printf '%s' "$ports_raw" | tr ',' ' '); do
	case $p in
		'' | *[!0-9]*) fail "PORTS: \"$p\" is not a port number. Use a list like PORTS=8080,8081 in .env." ;;
	esac
	if [ "$p" -lt 1 ] || [ "$p" -gt 65535 ]; then fail "PORTS: $p is out of range (1 to 65535)."; fi
	case " $PORTS " in *" $p "*) fail "PORTS: $p is listed twice." ;; esac
	PORTS="${PORTS:+$PORTS }$p"
done
case $ports_raw in *,,* | ,* | *,) fail "PORTS: an entry is empty. Use a list like PORTS=8080,8081 in .env." ;; esac
[ -n "$PORTS" ] || fail "PORTS: no ports listed. Use a list like PORTS=8080,8081 in .env."
ports_list=$(printf '%s' "$PORTS" | sed 's/ /, /g')

# 3. The saved APP_PORT, which may carry a bind address (127.0.0.1:3000): keep the address, change only the port.
app_port_raw=$(env_get APP_PORT)
bind=""
saved=""
if [ -n "$app_port_raw" ]; then
	saved=${app_port_raw##*:}
	[ "$saved" = "$app_port_raw" ] || bind=${app_port_raw%:*}:
	case $saved in '' | *[!0-9]*) fail "APP_PORT: \"$app_port_raw\" does not end in a port number." ;; esac
fi
# The port Compose publishes now: the saved one, or Compose's own default.
current=${saved:-$CONTAINER_PORT}

# Is a port in use? Sets HOLDER to the program holding it, when the system reports it.
CHECKER=""
if have ss; then
	CHECKER=ss
elif have lsof; then
	CHECKER=lsof
elif have nc; then
	CHECKER=nc
else
	fail "Cannot check ports: install ss (iproute2), lsof or nc, or set APP_PORT in .env and run docker compose up -d."
fi
in_use() {
	HOLDER=""
	case $CHECKER in
		ss)
			out=$(ss -Hltnp "sport = :$1" 2>/dev/null || ss -ltnp "sport = :$1" 2>/dev/null | tail -n +2)
			[ -n "$out" ] || return 1
			HOLDER=$(printf '%s\n' "$out" | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -n 1)
			;;
		lsof)
			out=$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -Fc 2>/dev/null || true)
			[ -n "$out" ] || return 1
			HOLDER=$(printf '%s\n' "$out" | sed -n 's/^c//p' | head -n 1)
			;;
		nc) nc -z 127.0.0.1 "$1" >/dev/null 2>&1 || return 1 ;;
	esac
	return 0
}
holder() { if [ -n "$HOLDER" ]; then printf '%s' "$HOLDER"; else printf 'program not reported'; fi; }

# The host port this project's own app container publishes now, or empty (not running, or docker unreachable).
own_port() {
	docker compose port app "$CONTAINER_PORT" 2>/dev/null | tail -n 1 | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p'
}

# 4. Pick the port.
chosen=""
moved_from=""
first_taken=""
if [ -n "$saved" ] && in_use "$saved"; then
	if [ "$(own_port)" = "$saved" ]; then
		say "Port $saved is published by this app's own container: keeping it."
		chosen=$saved
	else
		moved_from=$saved
		say "Checking ports $ports_list"
		say "  $saved  in use ($(holder)), not this app"
	fi
elif [ -n "$saved" ]; then
	say "Checking port $saved (APP_PORT in .env)"
	say "  $saved  free"
	chosen=$saved
	say "Using port $saved."
fi

if [ -z "$chosen" ]; then
	[ -n "$moved_from" ] || say "Checking ports $ports_list"
	for p in $PORTS; do
		[ "$p" != "$moved_from" ] || continue
		if in_use "$p"; then
			say "  $p  in use ($(holder))"
			[ -n "$first_taken" ] || first_taken=$p
		else
			say "  $p  free"
			chosen=$p
			break
		fi
	done
	if [ -z "$chosen" ]; then
		range=$(printf '%s' "$PORTS" | awk '{
			run = NF > 1; for (i = 2; i <= NF; i++) if ($i != $(i - 1) + 1) run = 0
			if (run) printf "%s\342\200\223%s", $1, $NF; else { gsub(/ /, ", "); printf "%s", $0 }
		}')
		say "Warning: ports $range are all in use. The app was not started."
		say "Free one of them, or set other ports in .env, for example:"
		say "  PORTS=8080,8081"
		say "Then run ./start.sh again."
		exit 1
	fi
	if [ -n "$moved_from" ]; then
		say "The saved port $moved_from is now used by another program, so the app moves to $chosen."
		say "Links that point to port $moved_from (invites, bookmarks) stop working. Share the new address."
	elif [ -n "$first_taken" ]; then
		say "$first_taken was in use; using $chosen."
	fi
fi

# 5. Write what changed: APP_PORT, and an http ORIGIN whose port was the old one (or one of PORTS).
changes=""
if [ "$chosen" != "$saved" ]; then
	env_set APP_PORT "$bind$chosen"
	changes="APP_PORT=$bind$chosen"
fi
origin=$(env_get ORIGIN)
case $origin in
	http://*:*)
		origin_port=$(printf '%s' "$origin" | sed -n 's#^http://.*:\([0-9][0-9]*\)/*$#\1#p')
		if [ -n "$origin_port" ] && [ "$origin_port" != "$chosen" ]; then
			case " $PORTS $current " in
				*" $origin_port "*)
					origin=$(printf '%s' "$origin" | sed "s#:$origin_port/*\$#:$chosen#")
					env_set ORIGIN "$origin"
					changes="${changes:+$changes, }ORIGIN=$origin"
					;;
			esac
		fi
		;;
esac
if [ -n "$changes" ]; then
	if [ -z "$saved" ] && [ -z "$first_taken" ] && [ "$changes" = "APP_PORT=$bind$chosen" ]; then
		say "Using port $chosen. .env: $changes"
	else
		say "Updated .env: $changes"
	fi
fi

# 6. Start, wait until ready, say where.
say "docker compose up -d${*:+ $*}"
if ! docker compose up -d "$@"; then
	fail "docker compose up failed. If a port was taken in the meantime, run ./start.sh again."
fi

address=${origin:-http://localhost:$chosen}
wait_for=${FL_WAIT_SECONDS:-120}
if [ "$wait_for" -gt 0 ]; then
	host=127.0.0.1
	case $bind in '' | 0.0.0.0: | '[::]:') ;; *) host=${bind%:} ;; esac
	url="http://$host:$chosen/health/ready"
	probe=""
	if have curl; then
		probe="curl -fsS -o /dev/null"
	elif have wget; then
		probe="wget -q -O /dev/null"
	fi
	printf 'Waiting for the app to be ready … '
	waited=0
	while :; do
		if [ -z "$probe" ]; then
			say "skipped (no curl or wget to ask $url)"
			break
		fi
		if $probe "$url" >/dev/null 2>&1; then
			say "ready ($waited s)"
			break
		fi
		if [ "$waited" -ge "$wait_for" ]; then
			say "not ready after $waited s."
			fail "See what it says: docker compose logs app"
		fi
		sleep 2
		waited=$((waited + 2))
	done
fi
say "Forgotten Letters runs at $address"
