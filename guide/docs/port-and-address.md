# Port and address

## With Docker

The port is set outside the app, so the settings page shows it read-only. To change it:

1. Edit `APP_PORT` in `.env`, for example `APP_PORT=8080`.
2. Change `ORIGIN` to match, for example `ORIGIN=http://192.168.1.20:8080`.
3. Restart: `docker compose up -d`.

## Without Docker

Run `npm --prefix app run build`, then `node app/server`. The owner can then change the port under
**Owner → Settings**: the app opens the new port, sends the browser there and closes the old one. Set
`PORT_LOCKED=true` to keep it fixed.

## The address

`ORIGIN` is the address people type into their browser. Invite and seat links are built from it, so it must be
an address the other players can reach (this machine's LAN IP, not `localhost`).
