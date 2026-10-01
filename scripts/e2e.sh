#!/usr/bin/env bash
# End-to-end tests of signing in and access, on a throwaway copy of the app (never the live stack):
#   1. copy the tracked tree to a temporary folder and start it as its own compose project (cf-e2e, port 3200,
#      its own volumes), with a known Campaign Master password and the client address taken from X-Forwarded-For;
#   2. run the Playwright suite in open mode, then again over this machine's network address (another device on
#      the LAN), then restart the app in private mode and run it once more;
#   3. tear the copy down, volumes and images included.
#
#   ./scripts/e2e.sh              everything
#   ./scripts/e2e.sh --keep       leave the throwaway stack running afterwards (http://localhost:3200)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
KEEP="${1:-}"
PORT=3200
PROJECT=cf-e2e
WORK="$(mktemp -d)"
say() { printf '\033[1m%s\033[0m\n' "$*"; }

teardown() {
	if [[ "$KEEP" == "--keep" ]]; then
		say "Kept the test stack at http://localhost:$PORT ($WORK). Remove it with: (cd $WORK && docker compose down -v)"
		return
	fi
	(cd "$WORK" && docker compose down -v >/dev/null 2>&1) || true
	docker image rm $(docker images "$PROJECT" --format '{{.Repository}}:{{.Tag}}') >/dev/null 2>&1 || true
	rm -rf "$WORK"
	say "Test stack removed."
}
trap teardown EXIT

say "Copying the app to $WORK"
git ls-files -co --exclude-standard | grep -v '^\.codex/' | rsync -a --files-from=- ./ "$WORK/"
CM_PASS="e2e-cm-$(openssl rand -hex 6)"
cat > "$WORK/.env" <<ENV
COMPOSE_PROJECT_NAME=$PROJECT
IMAGE=$PROJECT
PORT=$PORT
POSTGRES_PASSWORD=$(openssl rand -hex 12)
ADMIN_USERNAME=cm
ADMIN_PASSWORD=$CM_PASS
ACCESS=open
# Each test sends its own X-Forwarded-For, so rate limits apply per test as they would per visitor.
ADDRESS_HEADER=x-forwarded-for
XFF_DEPTH=1
ENV

say "Starting the test stack (open mode)"
(cd "$WORK" && ./build_and_update.sh >/dev/null)

run() {
	local mode="$1" base="$2"
	say "Suite: ACCESS=$mode at $base"
	(cd "$ROOT/app" && E2E_STACK_DIR="$WORK" E2E_BASE="$base" E2E_ACCESS="$mode" E2E_ADMIN_PASSWORD="$CM_PASS" npx playwright test)
}

run open "http://localhost:$PORT"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -n "$LAN_IP" ]]; then run open "http://$LAN_IP:$PORT"; else say "No network address found: skipping the LAN pass."; fi

say "Restarting the test stack in private mode"
sed -i 's/^ACCESS=.*/ACCESS=private/' "$WORK/.env"
(cd "$WORK" && docker compose up -d --wait >/dev/null)
run private "http://localhost:$PORT"
say "All sign-in and access tests passed in both modes."
