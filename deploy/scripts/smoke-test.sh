#!/usr/bin/env bash
set -euo pipefail

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://foodtruckzs.com}"
API_INTERNAL_BASE_URL="${API_INTERNAL_BASE_URL:-http://127.0.0.1:4000}"
WEB_INTERNAL_BASE_URL="${WEB_INTERNAL_BASE_URL:-http://127.0.0.1:3000}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-10}"

check_url() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local status

  status="$(curl --silent --show-error --location --max-time "$TIMEOUT_SECONDS" --output /dev/null --write-out "%{http_code}" "$url")"

  if [[ "$status" != "$expected" ]]; then
    echo "Smoke check failed for ${label}: expected ${expected}, got ${status} (${url})" >&2
    exit 1
  fi

  echo "ok ${label} ${status}"
}

check_url "api health internal" "${API_INTERNAL_BASE_URL}/healthz"
check_url "api readiness internal" "${API_INTERNAL_BASE_URL}/readyz"
check_url "web internal" "${WEB_INTERNAL_BASE_URL}/"
check_url "public web" "${PUBLIC_BASE_URL}/"
check_url "public api health" "${PUBLIC_BASE_URL}/api/healthz"
check_url "public api readiness" "${PUBLIC_BASE_URL}/api/readyz"

if command -v pm2 >/dev/null 2>&1; then
  pm2 describe foodtruckzs-web >/dev/null
  pm2 describe foodtruckzs-api >/dev/null
  pm2 describe foodtruckzs-worker >/dev/null
  echo "ok pm2 processes found"
fi

echo "Smoke tests passed."
