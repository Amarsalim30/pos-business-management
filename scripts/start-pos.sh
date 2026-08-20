#!/usr/bin/env bash
# ==============================================================================
# Modern POS & Business Management System - Local Store Production Bootstrapper
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

echo "======================================================================"
echo " Starting Modern POS & Business Management System (Local Store Mode)  "
echo "======================================================================"

# 1. Check Python Virtualenv
if [ ! -d "${BACKEND_DIR}/.venv" ]; then
    echo "[!] Creating backend Python virtual environment..."
    python3 -m venv "${BACKEND_DIR}/.venv"
    "${BACKEND_DIR}/.venv/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
fi

# 2. Check Database Migrations
echo "[+] Applying latest database migrations..."
cd "${BACKEND_DIR}"
PYTHONPATH="${BACKEND_DIR}" "${BACKEND_DIR}/.venv/bin/alembic" upgrade head

# 3. Check Frontend Build
if [ ! -d "${FRONTEND_DIR}/dist" ]; then
    echo "[+] Building frontend production client assets..."
    cd "${FRONTEND_DIR}"
    npm run build
fi

# 4. Launch Backend API
echo "[+] Starting Backend API Server on http://127.0.0.1:8000..."
cd "${BACKEND_DIR}"
PYTHONPATH="${BACKEND_DIR}" "${BACKEND_DIR}/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "[+] POS System is live!"
echo "    - Backend API: http://127.0.0.1:8000"
echo "    - API Docs:    http://127.0.0.1:8000/docs"
echo "    - Frontend:    http://127.0.0.1:5173 or local web server"
echo "Press Ctrl+C to stop all services."

trap "kill ${BACKEND_PID} 2>/dev/null || true; exit 0" INT TERM
wait ${BACKEND_PID}
