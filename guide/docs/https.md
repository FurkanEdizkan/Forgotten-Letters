# HTTPS

For a server on the internet, Caddy (bundled, profile `https`) gets and renews the certificate.

1. Point your domain's DNS at the server and open ports 80 and 443.
2. In `.env` set:

    ```sh
    DOMAIN=letters.example.org
    ORIGIN=https://letters.example.org
    ADDRESS_HEADER=X-Forwarded-For
    XFF_DEPTH=1
    APP_PORT=127.0.0.1:3000
    ```

    `APP_PORT=127.0.0.1:3000` keeps the app reachable only through Caddy, so nobody can fake their address. Never
    set `ADDRESS_HEADER` without it.

3. Start with `docker compose --profile https up -d` (or set `COMPOSE_PROFILES=https`).
