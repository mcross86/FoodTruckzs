#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST is required.}"
DEPLOY_USER="${DEPLOY_USER:?DEPLOY_USER is required.}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-/var/www/foodtruckzs}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-/etc/foodtruckzs/foodtruckzs.env}"
DEPLOY_REF="${DEPLOY_REF:-main}"
DEPLOY_REPO_URL="${DEPLOY_REPO_URL:?DEPLOY_REPO_URL is required.}"
DEPLOY_KEEP_RELEASES="${DEPLOY_KEEP_RELEASES:-5}"
DEPLOY_PUBLIC_BASE_URL="${DEPLOY_PUBLIC_BASE_URL:-https://foodtruckzs.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_SCRIPT="${SCRIPT_DIR}/deploy-on-vps.sh"

if [[ ! -f "$REMOTE_SCRIPT" ]]; then
  echo "Missing remote deploy script: ${REMOTE_SCRIPT}" >&2
  exit 1
fi

remote_env="$(
  printf "APP_DIR=%q ENV_FILE=%q REPO_URL=%q DEPLOY_REF=%q KEEP_RELEASES=%q PUBLIC_BASE_URL=%q" \
    "$DEPLOY_APP_DIR" \
    "$DEPLOY_ENV_FILE" \
    "$DEPLOY_REPO_URL" \
    "$DEPLOY_REF" \
    "$DEPLOY_KEEP_RELEASES" \
    "$DEPLOY_PUBLIC_BASE_URL"
)"

ssh_args=(-p "$DEPLOY_SSH_PORT")
if [[ -n "${DEPLOY_SSH_KEY_PATH:-}" ]]; then
  ssh_args+=(-i "$DEPLOY_SSH_KEY_PATH" -o IdentitiesOnly=yes)
fi

ssh "${ssh_args[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "${remote_env} bash -s" < "$REMOTE_SCRIPT"
