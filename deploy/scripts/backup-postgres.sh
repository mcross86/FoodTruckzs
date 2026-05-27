#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/foodtruckzs/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_FILE="${BACKUP_DIR}/foodtruckzs-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
umask 077

echo "Creating PostgreSQL backup at ${BACKUP_FILE}"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE"

if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  echo "Encrypting backup for ${BACKUP_GPG_RECIPIENT}"
  gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$BACKUP_FILE"
  rm -f "$BACKUP_FILE"
  BACKUP_FILE="${BACKUP_FILE}.gpg"
fi

if [[ -n "${BACKUP_AFTER_CREATE_COMMAND:-}" ]]; then
  echo "Running BACKUP_AFTER_CREATE_COMMAND"
  BACKUP_FILE="$BACKUP_FILE" bash -c "$BACKUP_AFTER_CREATE_COMMAND"
fi

echo "Pruning backups older than ${BACKUP_RETENTION_DAYS} days from ${BACKUP_DIR}"
find "$BACKUP_DIR" -type f \( -name "foodtruckzs-*.dump" -o -name "foodtruckzs-*.dump.gpg" \) \
  -mtime "+${BACKUP_RETENTION_DAYS}" \
  -delete

echo "Backup complete: ${BACKUP_FILE}"
