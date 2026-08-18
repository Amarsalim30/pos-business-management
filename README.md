# Modern POS & Business Management System

A modern, local-first Point of Sale and Business Management system built with **FastAPI**, **SQLAlchemy**, **PostgreSQL**, and **React + TypeScript + Tailwind CSS**.

---

## 🚀 Getting Started

### 1. Backend Setup & Run

The backend application is located under `backend/app/`.

```bash
# Sync dependencies
uv sync

# Run backend development server (pointing to backend application)
uv run fastapi dev backend/app/main.py
```

API docs will be available at: `http://localhost:8000/docs`

---

### 2. Frontend Setup & Run

```bash
cd frontend
bun install
bun run dev
```

Frontend application will be running at: `http://localhost:5173`

---

### 3. Running Tests

```bash
# Run backend test suite with coverage
uv run pytest -v
```

---

## 📂 Project Structure

```
pos-business-management/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint
│   │   ├── dependencies.py    # Auth and RBAC dependencies
│   │   ├── core/              # Config, Security, Database
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Business logic layer
│   │   └── routers/           # API endpoints (/auth, /users, /stores)
│   └── tests/                 # Pytest test suite
├── frontend/                  # React 19 + Vite + TypeScript + Tailwind CSS v4
├── docs/                      # POS plan, ADRs, documentation
├── CONTEXT.md                 # Domain glossary & ubiquitous language
└── pyproject.toml
```
