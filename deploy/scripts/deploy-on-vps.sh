#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/foodtruckzs}"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
ENV_FILE="${ENV_FILE:-/etc/foodtruckzs/foodtruckzs.env}"
REPO_URL="${REPO_URL:?REPO_URL is required.}"
DEPLOY_REF="${DEPLOY_REF:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RELEASE_ID="$(date -u +"%Y%m%dT%H%M%SZ")-${DEPLOY_REF:0:12}"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"

echo "Preparing release ${RELEASE_ID}"
mkdir -p "$RELEASES_DIR"

git init "$RELEASE_DIR"
git -C "$RELEASE_DIR" remote add origin "$REPO_URL"
git -C "$RELEASE_DIR" fetch --depth=1 origin "$DEPLOY_REF"
git -C "$RELEASE_DIR" checkout --detach FETCH_HEAD

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

export FOODTRUCKZS_RELEASE_DIR="$RELEASE_DIR"
cd "$RELEASE_DIR"

corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm build

echo "Creating pre-migration database backup"
bash deploy/scripts/backup-postgres.sh

echo "Running database migrations"
pnpm db:migrate:prod

PREVIOUS_RELEASE=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK")"
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
if [[ -n "$PREVIOUS_RELEASE" ]]; then
  echo "$PREVIOUS_RELEASE" > "${APP_DIR}/previous_release"
fi

echo "Reloading PM2 processes"
pm2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --env production --update-env
pm2 save

echo "Running smoke tests"
bash "$CURRENT_LINK/deploy/scripts/smoke-test.sh"

echo "Pruning old releases, keeping ${KEEP_RELEASES}"
mapfile -t old_releases < <(ls -1dt "${RELEASES_DIR}"/* 2>/dev/null | sed -e "1,${KEEP_RELEASES}d")
for old_release in "${old_releases[@]}"; do
  if [[ "$old_release" != "$RELEASE_DIR" && "$old_release" != "$PREVIOUS_RELEASE" ]]; then
    rm -rf "$old_release"
  fi
done

echo "Deploy complete: ${RELEASE_DIR}"
