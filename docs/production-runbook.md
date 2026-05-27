# foodtruckzs Production Runbook

This runbook covers the initial GoDaddy VPS deployment target: Ubuntu, Apache2, PM2, PostgreSQL, and Let's Encrypt SSL.

## Server Layout

- App root: `/var/www/foodtruckzs`
- Current release symlink: `/var/www/foodtruckzs/current`
- Release history: `/var/www/foodtruckzs/releases`
- Previous release pointer: `/var/www/foodtruckzs/previous_release`
- Environment file: `/etc/foodtruckzs/foodtruckzs.env`
- PostgreSQL backups: `/var/backups/foodtruckzs/postgres`

Keep `/etc/foodtruckzs/foodtruckzs.env` owned by the deploy user or readable only by the deploy user and PM2 process owner:

```sh
sudo mkdir -p /etc/foodtruckzs
sudo cp deploy/production.env.example /etc/foodtruckzs/foodtruckzs.env
sudo chmod 600 /etc/foodtruckzs/foodtruckzs.env
```

Fill in real production secrets before starting PM2. Do not commit the filled file.

## First-Time VPS Setup

Install runtime dependencies:

```sh
sudo apt update
sudo apt install -y apache2 certbot python3-certbot-apache postgresql postgresql-client git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@9.15.9 --activate
sudo npm install -g pm2
```

Create the database and app user:

```sh
sudo -u postgres createuser foodtruckzs_app --pwprompt
sudo -u postgres createdb foodtruckzs --owner foodtruckzs_app
```

Enable Apache modules and site:

```sh
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo cp deploy/apache/foodtruckzs.conf /etc/apache2/sites-available/foodtruckzs.conf
sudo apache2ctl configtest
sudo a2ensite foodtruckzs
sudo systemctl reload apache2
sudo certbot --apache -d foodtruckzs.com -d www.foodtruckzs.com
```

## Deploy

The recommended path is the manual GitHub Actions workflow `.github/workflows/deploy.yml`. Required repository secrets:

- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_SSH_PORT` optional, defaults to `22`
- `PROD_APP_DIR` optional, defaults to `/var/www/foodtruckzs`
- `PROD_ENV_FILE` optional, defaults to `/etc/foodtruckzs/foodtruckzs.env`
- `PROD_REPO_URL` optional, defaults to the current GitHub repository URL
- `PROD_PUBLIC_BASE_URL` optional, defaults to `https://foodtruckzs.com`

The VPS must be able to fetch `PROD_REPO_URL`. For private repositories, install a read-only deploy key on the VPS or use a deploy URL that the VPS can access.

Manual deploy from a local machine or CI runner:

```sh
DEPLOY_HOST=example-vps-ip \
DEPLOY_USER=deploy \
DEPLOY_REPO_URL=git@github.com:owner/foodtruckzs.git \
DEPLOY_REF=main \
DEPLOY_PUBLIC_BASE_URL=https://foodtruckzs.com \
deploy/scripts/deploy-ssh.sh
```

The deploy script:

1. Creates a new release under `/var/www/foodtruckzs/releases`.
2. Installs dependencies with `pnpm install --frozen-lockfile`.
3. Builds web, API, worker, and shared packages with `pnpm build`.
4. Runs a pre-migration PostgreSQL backup.
5. Runs Drizzle migrations.
6. Switches `/var/www/foodtruckzs/current` to the new release.
7. Reloads `foodtruckzs-web`, `foodtruckzs-api`, and `foodtruckzs-worker` with PM2.
8. Runs smoke checks.

## Database Migrations

Production migration command:

```sh
set -a
. /etc/foodtruckzs/foodtruckzs.env
set +a
cd /var/www/foodtruckzs/current
pnpm db:migrate:prod
```

Always run a database backup before production migrations:

```sh
set -a
. /etc/foodtruckzs/foodtruckzs.env
set +a
cd /var/www/foodtruckzs/current
bash deploy/scripts/backup-postgres.sh
```

## Backups

Manual logical backup:

```sh
set -a
. /etc/foodtruckzs/foodtruckzs.env
set +a
cd /var/www/foodtruckzs/current
bash deploy/scripts/backup-postgres.sh
```

Recommended cron entry for daily backups:

```cron
15 6 * * * cd /var/www/foodtruckzs/current && set -a && . /etc/foodtruckzs/foodtruckzs.env && set +a && bash deploy/scripts/backup-postgres.sh >> /var/log/foodtruckzs-backup.log 2>&1
```

Set `BACKUP_GPG_RECIPIENT` to encrypt backup files with GPG. Set `BACKUP_AFTER_CREATE_COMMAND` to copy the new backup to off-VPS storage, for example an S3-compatible upload command. Keep at least 14 to 30 days of backups and run a restore test monthly.

## Backup Restore

Restore into a fresh database when possible:

```sh
sudo -u postgres createdb foodtruckzs_restore --owner foodtruckzs_app
pg_restore --dbname=postgres://foodtruckzs_app:replace-me@127.0.0.1:5432/foodtruckzs_restore --clean --if-exists /var/backups/foodtruckzs/postgres/foodtruckzs-YYYYMMDDTHHMMSSZ.dump
```

For a production replacement restore:

1. Put the app in maintenance mode at Apache or stop PM2.
2. Take one final backup of the damaged database if possible.
3. Restore into a new database and verify counts and critical records.
4. Point `DATABASE_URL` in `/etc/foodtruckzs/foodtruckzs.env` to the restored database.
5. Restart PM2 and run smoke checks.

```sh
pm2 stop foodtruckzs-web foodtruckzs-api foodtruckzs-worker
pm2 startOrReload /var/www/foodtruckzs/current/ecosystem.config.cjs --env production --update-env
bash /var/www/foodtruckzs/current/deploy/scripts/smoke-test.sh
```

Prefer forward database fixes for normal migration problems. Full restore is for catastrophic corruption or data loss.

## Restart And Process Health

Reload all app processes:

```sh
set -a
. /etc/foodtruckzs/foodtruckzs.env
set +a
pm2 startOrReload /var/www/foodtruckzs/current/ecosystem.config.cjs --env production --update-env
pm2 save
```

Restart a single process:

```sh
pm2 restart foodtruckzs-api --update-env
pm2 restart foodtruckzs-web --update-env
pm2 restart foodtruckzs-worker --update-env
```

Inspect process state:

```sh
pm2 status
pm2 describe foodtruckzs-api
```

## Smoke Tests

Run after deploy, rollback, restart, migration, and restore:

```sh
PUBLIC_BASE_URL=https://foodtruckzs.com bash /var/www/foodtruckzs/current/deploy/scripts/smoke-test.sh
```

The smoke script checks:

- API process health at `/healthz`.
- API database readiness at `/readyz`.
- Web process response.
- Apache public web response.
- Apache public `/api/healthz` and `/api/readyz` proxy mappings.
- PM2 process presence when PM2 is available.

## Rollback

Rollback is safe only when the database migration is backward compatible. The release script stores the previous release path in `/var/www/foodtruckzs/previous_release`.

```sh
PREVIOUS_RELEASE="$(cat /var/www/foodtruckzs/previous_release)"
test -d "$PREVIOUS_RELEASE"
ln -sfn "$PREVIOUS_RELEASE" /var/www/foodtruckzs/current
set -a
. /etc/foodtruckzs/foodtruckzs.env
set +a
pm2 startOrReload /var/www/foodtruckzs/current/ecosystem.config.cjs --env production --update-env
bash /var/www/foodtruckzs/current/deploy/scripts/smoke-test.sh
```

If a deploy failed after migrations and the schema is not backward compatible, fix forward unless restoring from backup is the only safe option.

## Log Inspection

PM2 logs:

```sh
pm2 logs foodtruckzs-api --lines 200
pm2 logs foodtruckzs-web --lines 200
pm2 logs foodtruckzs-worker --lines 200
```

Apache logs:

```sh
sudo journalctl -u apache2 -n 200 --no-pager
sudo less /var/log/apache2/foodtruckzs-error.log
sudo less /var/log/apache2/foodtruckzs-access.log
```

PostgreSQL logs and status:

```sh
sudo systemctl status postgresql --no-pager
sudo journalctl -u postgresql -n 200 --no-pager
```

Useful PM2 maintenance commands:

```sh
pm2 flush
pm2 monit
pm2 save
pm2 startup
```
