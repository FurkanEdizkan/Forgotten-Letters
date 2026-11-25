# Port and address

The port is picked when the app starts, never in the browser. The app tries the ports in `PORTS`, in order, and
uses the first free one. The default list is 3000, 3001, 3002, 3003, 3004 and 3005. **Owner → Settings** shows
the address and port, read-only.

## With Docker

Start with `./start.sh` (Windows: `.\start.ps1`). It checks the ports on this machine, writes the first free one
into `.env` as `APP_PORT`, and runs `docker compose up -d`:

- If `ORIGIN` is plain `http` on the old port, it is changed to the new port too. An `https` `ORIGIN`, or one
  without a port, is never touched.
- A bind address in front of the port (`APP_PORT=127.0.0.1:3000`) stays.
- Running it again while the app runs keeps the port the app already uses.
- Only the lines it changed are printed; nothing else from `.env`.

To pick a port yourself, set `APP_PORT` in `.env` (for example `APP_PORT=8080`, and `ORIGIN` to match), then run
`./start.sh` or `docker compose up -d`.

## Without Docker

Run `npm --prefix app run build`, then `node app/server`. The server tries `PORTS` itself and logs each move, for
example `Port 3000 is in use, trying 3001`. After a move, a plain `http` `ORIGIN` on a listed port follows the
port for that run, and **Owner → Settings** says which port was in use.

## Port already in use

If the first port is taken, the app (or `./start.sh`) moves to the next free one and says so. Links that point to
the old port, such as invites and bookmarks, then stop working: share the new address.

If a saved `APP_PORT` is taken by another program on a later start, `./start.sh` moves to the next free port and
warns that links changed.

If every port in the list is taken, nothing starts. You see each port, the program holding it when the system
reports it, and a hint. Free one of the ports, or set others in `.env`:

```sh
PORTS=8080,8081
```

Then start again.

## The address

`ORIGIN` is the address people type into their browser. Invite and seat links are built from it, so it must be
an address the other players can reach (this machine's LAN IP, not `localhost`).
