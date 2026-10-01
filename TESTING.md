# Testing signing in and access

Two layers: the automated suite covers every case on a throwaway copy of the app, and a short manual pass on real
devices covers what only real devices show (a phone on the venue's Wi-Fi, a real domain).

## 1. Automated (every change to sign-in or access)

```sh
cd app && npm test        # unit, including the access matrix (src/lib/server/access.spec.ts)
cd .. && ./scripts/e2e.sh # end to end, on a throwaway stack; never touches the live one
```

`scripts/e2e.sh`:
1. Copies the app and starts it as its own compose project (`cf-e2e`, port 3200, its own volumes).
2. Runs `app/e2e/*.spec.ts` three times:
   - `ACCESS=open` at `localhost`;
   - `ACCESS=open` at this machine's network address (another device on the LAN);
   - `ACCESS=private`.
3. Removes everything.

Use `--keep` to leave the stack running for a look.

| Area | Cases covered |
|---|---|
| Access (open) | The guest map with standings and Sign in; read-only pages open; the admin asks for a sign-in; the live stream is open and carries no Vision cards |
| Access (private) | Every page goes to the sign-in page, keeping `next`; the stream, the round API and uploads answer 401; form posts answer 401; invite links still work; signed in, everything opens |
| Signing in | The CM signs in at `/admin/login` (where `/admin` leads) and lands on the console; each door refuses the other's accounts with the same answer as a wrong password; guessing at the CM from one address is held up there, while the CM still walks in from their own; remember me renews with the session (unit); a wrong password and an unknown account get the same answer; a disabled account is refused; the 6th try in a minute from one address is turned away; `next` is kept and another site ignored; remember me lasts 30 days, unticked ends with the browser; signing out kills the old cookie; the `.env` account can't change its password in Settings |
| Players | A new player must choose a password before anything else; a password change signs out other devices; a player on `/admin` gets a 403 page, not a redirect loop, and its "Sign in as someone else" opens the CM's door |
| Requests | Sign-up: approved, then signs in; declined, can't. Reset: a temporary password, then a forced change |
| Invites | A link makes an account, seats it, signs it in and lands on `/muster`; used, withdrawn and expired links say so (the expired one is aged in the test stack's database) |

## 2. Manual, on real devices (each release)

### A. At the venue: `ACCESS=open` on the LAN

| # | Do | Expect | ✓ |
|---|---|---|---|
| 1 | On the server, `./build_and_update.sh`. It prints `Access: open` | The app is up | |
| 2 | On a phone on the same Wi-Fi, open `http://<server address>:3000` | The live map as a guest, standings docked, a Sign in chip; no navigation panel | |
| 3 | Open the TV's browser on the same address | The same map; live updates arrive when the CM changes something | |
| 4 | On the phone, Sign in as a player (no remember me) | Lands on the map with the panel; their warband under My warband | |
| 5 | Close and reopen the phone's browser | Signed out again | |
| 6 | Sign in again with remember me; close and reopen the browser | Still signed in | |
| 7 | As that player, open `/admin` | "Only the Campaign Master can open this", with a way back | |
| 8 | On the laptop, open `/admin`, sign in as `cm` at the CM's door, open Weather and change the sky | The phone and the TV follow within a second | |

### B. Deployed: `ACCESS=private` on a domain

| # | Do | Expect | ✓ |
|---|---|---|---|
| 1 | Set `DOMAIN` (and `COMPOSE_PROFILES=https`), then `./build_and_update.sh`. It prints `Access: private` and adds `ACCESS=private` to `.env` | https works, with a certificate | |
| 2 | In a private window, open the domain | The sign-in page only: "This campaign is private"; no Back to the map | |
| 3 | Open `https://<domain>/players` and `/api/stream` | The sign-in page (`next` kept); the stream says 401 | |
| 4 | As `cm` (at `https://<domain>/admin`), Admin → Muster → invite a seat; open the link on a phone with no account | The join page; joining signs in and shows the muster checklist | |
| 5 | On another device, Create account → request; as `cm`, approve it in Admin → Players | The new account signs in with the password it chose | |
| 6 | Forgot password for that account; as `cm`, Issue temporary password | Signing in with it asks for a new password first | |
| 7 | Sign out | Back at the sign-in page; the map is not reachable | |

Record the date, version (`git rev-parse --short HEAD`) and who ran it beside each table.
