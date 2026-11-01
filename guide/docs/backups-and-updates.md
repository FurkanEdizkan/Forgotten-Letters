# Backups and updates

## Backups

The app writes a compressed `pg_dump` before every migration and once a day into the `backups` volume (kept 14
days, `BACKUP_KEEP_DAYS`). Owners download and restore them in the owner area. To copy them out, or restore by
hand:

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

## Locked out

```sh
docker compose exec app node scripts/owner-recovery.js <username>
```

This gives that owner a temporary password (changed at the next sign-in) and ends their sessions. Without a
username it lists the owners, or says that setup is open when there is none.
