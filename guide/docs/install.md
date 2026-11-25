# Install

You need Docker (Docker Desktop, or Docker Engine with the Compose plugin). Everything the app needs ships in the
image.

1. Put `compose.yaml`, `Caddyfile`, `.env.example` and `start.sh` (`start.ps1` on Windows) in a folder.
2. Start it: `./start.sh` (Windows: `.\start.ps1`). The first time, it makes `.env` from `.env.example` with a new
   random database password, which it never prints. It then picks the first free port of 3000 to 3005, writes it
   into `.env` as `APP_PORT` and runs `docker compose up -d`. See [Port and address](port-and-address.md).
3. In `.env`, set `ORIGIN`, the address people type: `http://<this machine's IP>:<port>` on a LAN,
   `https://<DOMAIN>` with HTTPS. Run `./start.sh` again after changing `.env`.
4. Open the address in a browser. Until an owner exists every page leads to the welcome page: press **Setup** and
   follow the three steps (owner account, look, done).

The log also says where setup is open:

```sh
docker compose logs app | grep "Setup is open"
```

Whoever opens a fresh install first becomes its owner, so set it up right away.

Back up `.env`: it holds the database password. Without the start script, copy `.env.example` to `.env`, set
`POSTGRES_PASSWORD` (for example `openssl rand -base64 24`) and run `docker compose up -d`.

Passwords must rate **Strong** or better; the meter under the field says why one is refused.
