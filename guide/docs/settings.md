# Settings

All settings live in `.env` next to `compose.yaml`; `.env.example` lists them with comments. Secrets may instead
be given as a file path in `<NAME>_FILE` (for example `POSTGRES_PASSWORD_FILE=/run/secrets/db`).

| Setting | Required | What it does |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | yes | Database password for the db and app containers. Set it once. |
| `ORIGIN` | yes | The address people type; used in invite and seat links. |
| `APP_PORT` | no | Host port (default 3000). |
| `LINK_KEY` | no | Key for the stored seat links (at least 16 characters). Unset, it is derived from the database password. Changing it turns existing seat links into "old links" that must be made again. |
| `DOMAIN`, `ADDRESS_HEADER`, `XFF_DEPTH` | with HTTPS | See [HTTPS](https.md). |
| `LOG_LEVEL` | no | `fatal`, `error`, `warn`, `info` (default), `debug`, `trace` or `silent`. |
| `BACKUP_DIR`, `BACKUP_KEEP_DAYS` | no | Where backups go inside the container, and how many days are kept (14). |
| `RETENTION_DAYS` | no | How long old records such as the audit log are kept (180, at least 7). |
| `DATABASE_URL` or `POSTGRES_HOST`/`PORT`/`USER`/`DB` | no | Another database instead of the bundled one. |
