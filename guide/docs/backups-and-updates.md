# Backups and updates

## Backups

The app writes a compressed `pg_dump` before every migration and once a day into the `backups` volume (kept 14
days, `BACKUP_KEEP_DAYS`). The Owner downloads and restores them in the owner area. To copy them out, or restore
by hand:

```sh
docker compose cp app:/data/backups ./backups                      # copy every dump to the host
docker compose exec app sh -c 'ls /data/backups'                   # list them
docker compose exec app sh -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_restore --clean --if-exists --no-owner \
  --single-transaction -h db -U letters -d letters /data/backups/<file>.dump'
```

Backups never contain the seat link key, so keep `.env` (or `LINK_KEY`) safe too.

## Updates

```sh
docker compose pull && docker compose up -d
```

The app backs up the database, applies migrations and starts; `/health/ready` answers 200 once it is done.

A copy has exactly one Owner. If yours had several before the update of 25 November 2026, the oldest active one
stays Owner and the others become Campaign Masters (Admins); the audit log names each of them. The Owner can hand
the copy to any of them afterwards (see below).

## Handing the copy to someone else

Ownership is never picked from the role list. The Owner opens **Owner → People**, finds the person under
**Transfer ownership**, types their own password and presses the button twice (the second press confirms, naming
both people). The new Owner takes over at once; the old one becomes a Campaign Master. Nobody is signed out.

## Locked out

```sh
docker compose exec app node scripts/owner-recovery.js <username>
```

This gives the Owner a temporary password (changed at the next sign-in), enables the account if it was disabled
and ends its sessions. Without a username it prints the Owner's username, or says that setup is open when there is
none.
