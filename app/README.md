# Forgotten Letters app

The SvelteKit app. Install and Docker notes are in the repository's `README.md`; how it is built is in
`ARCHITECTURE.md`, and the commands are listed in `AGENTS.md`.

## Running it

- **Development:** `docker compose -f ../compose.dev.yaml up -d` (database only), then `npm run dev`. The port is
  Vite's; the settings page shows the address the browser used.
- **Production build without Docker:** `npm run build`, then `node server` (with `DATABASE_URL` or the
  `POSTGRES_*` settings). It tries `PORTS` in order (default `3000,3001,3002,3003,3004,3005`; the legacy `PORT` is
  tried alone if `PORTS` is unset), logs each move, and exits 1 with one message when every port is taken.
- **Docker:** the image runs `node server` with `PORTS=3000` and `APP_IN_DOCKER=1`; `../start.sh` picks the host
  port and writes it into `APP_PORT` in `.env`.

## First run

While no owner exists, setup is open: every page leads to `/welcome`, the API answers 409, and the log says
"Setup is open at <address>". The setup wizard creates the owner and saves the text size and accent in one
step. Afterwards `/welcome` and `/setup` lead to `/login`.
