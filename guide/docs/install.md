# Install

You need Docker (Docker Desktop, or Docker Engine with the Compose plugin). Everything the app needs ships in the
image.

1. Put `compose.yaml`, `Caddyfile` and `.env.example` in a folder and copy `.env.example` to `.env`.
2. In `.env`, set `POSTGRES_PASSWORD` (for example `openssl rand -base64 24`) and `ORIGIN`, the address people
   type: `http://<this machine's IP>:3000` on a LAN, `https://<DOMAIN>` with HTTPS.
3. Start it: `docker compose up -d`.
4. Open the address in a browser. Until an owner exists every page leads to the welcome page: press **Setup** and
   follow the four steps (owner account, look, server, done).

The log also says where setup is open:

```sh
docker compose logs app | grep "Setup is open"
```

Whoever opens a fresh install first becomes its owner, so set it up right away.

Passwords must rate **Strong** or better; the meter under the field says why one is refused.
