#!/usr/bin/env bash
# ==============================================================================
# Modern POS & Business Management System - Automated Database Backup Script
# ==============================================================================
set -euo pipefail

# Configuration
BACKUP_DIR="${HOME}/.pos_backups"
DB_NAME="${DB_NAME:-pos_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS=30

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pos_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting POS database backup: ${DB_NAME}..."

if command -v pg_dump >/dev/null 2>&1; then
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created at: ${BACKUP_FILE}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: pg_dump command not found. Please install postgresql-client." >&2
    exit 1
fi

# Optional USB secondary storage copy if mounted
USB_MOUNT=$(find /media/"${USER:-$LOGNAME}" -maxdepth 2 -type d 2>/dev/null | grep -v "^/media/${USER:-$LOGNAME}$" | head -n 1 || true)
if [ -n "${USB_MOUNT}" ] && [ -d "${USB_MOUNT}" ]; then
    USB_BACKUP_DIR="${USB_MOUNT}/pos_backups"
    mkdir -p "${USB_BACKUP_DIR}" 2>/dev/null || true
    if [ -w "${USB_BACKUP_DIR}" ]; then
        cp "${BACKUP_FILE}" "${USB_BACKUP_DIR}/" 2>/dev/null || true
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Mirrored backup to USB: ${USB_BACKUP_DIR}/"
    fi
fi

# Retention pruning: Remove backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "pos_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete 2>/dev/null || true
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Retention pruning complete (retained last ${RETENTION_DAYS} days)."
