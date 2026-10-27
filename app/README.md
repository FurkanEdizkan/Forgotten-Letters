# Forgotten Letters app

The SvelteKit app. Install and Docker notes are in the repository's `README.md`; how it is built is in
`ARCHITECTURE.md`, and the commands are listed in `AGENTS.md`.

## Running it

- **Development:** `docker compose -f ../compose.dev.yaml up -d` (database only), then `npm run dev`. The port is
  Vite's and cannot be changed from the settings page.
- **Production build without Docker:** `npm run build`, then `node server` (with `DATABASE_URL` or the
  `POSTGRES_*` settings). `PORT` (default 3000) is only the first-run port: once setup is done, the app listens on
  the port saved in settings, and the owner can move it from the settings page. Set `PORT_LOCKED=true` to keep it
  fixed.
- **Docker:** the image runs `node server` with `PORT_LOCKED=1`; change the port with `APP_PORT` in `.env`.

## First run

While no owner exists, setup is open: every page leads to `/welcome`, the API answers 409, and the log says
"Setup is open at <address>". The setup wizard creates the owner and saves the text size, accent and port in one
step. Afterwards `/welcome` and `/setup` lead to `/login`.
