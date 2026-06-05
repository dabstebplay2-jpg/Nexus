# Nexus IDE Monorepo — Audit Report

**Date:** 2026-06-02  
**Phase:** 1 (read-only observation)  
**Scope:** Full monorepo, 43 non-ignored source files  
**Ignored paths:** `__pycache__/`, `venv/`, `node_modules/`, `.git/` (contents not scanned)

---

## Executive Summary

The workspace is a **multi-product monorepo** with three overlapping Python backends, one primary React IDE client, and several static/prototype frontends plus a separate `ai_nexus` product.

| Severity | Finding |
|----------|---------|
| **Critical** | [`backend/main.py`](backend/main.py) uses `subprocess.run` for Git routes but **never imports `subprocess`** → `NameError` when `/api/git/*` is called |
| **High** | Hardcoded JWT secrets in `nexus-backend` and `nexus-cloud-server`; committed Firebase API key in `ai_nexus` |
| **High** | `nexus-backend/` duplicates cloud auth; different `SECRET_KEY` than `nexus-cloud-server` |
| **Medium** | Unused pip packages in `nexus-backend`; unused imports in `nexus-backend` and `nexus-cloud-server` |
| **Medium** | No root `.gitignore`; `nexus_cloud_v2.db` committed; duplicate `venv/` trees |
| **Low** | Monolithic 889-line `backend/main.py`; no `ruff` / `pyproject.toml`; FastAPI version drift |

**Recommended Phase 2 actions:** Fix `subprocess` import, add `.gitignore`, trim `nexus-backend` deps, move secrets to environment variables, gitignore SQLite DB.

**Recommended Phase 3 actions:** Restructure `backend/` and `nexus-cloud-server/` into `app/` packages; add `pyproject.toml` + `ruff check`.

---

## Scope and Ignores

| Item | Value |
|------|-------|
| Core Python backends | `backend/`, `nexus-cloud-server/`, `nexus-backend/` |
| Audit scope | Full repo (frontends, portal, `ai_nexus`) |
| File count | **43** tracked source/config files |
| Entry points | `uvicorn main:app` per backend directory (cwd = that directory) |

---

## File Inventory

| Path | Type | Primary Purpose |
|------|------|-----------------|
| `NEXUSRULES.md` | Docs | Agent/IDE rules, ports 8000/5173/8080 |
| **backend/** | | |
| `backend/main.py` | Python | Nexus IDE FastAPI: files, git, DB, WS terminal, AI agent, cloud proxy |
| `backend/requirements.txt` | Deps | fastapi, uvicorn, pydantic, websockets, httpx |
| **nexus-cloud-server/** | | |
| `nexus-cloud-server/main.py` | Python | Cloud auth, billing, RouterAI proxy |
| `nexus-cloud-server/requirements.txt` | Deps | fastapi, sqlalchemy, passlib, pyjwt, httpx |
| `nexus-cloud-server/nexus_cloud_v2.db` | SQLite | Runtime DB (should not be in VCS) |
| **nexus-backend/** | | |
| `nexus-backend/main.py` | Python | Minimal in-memory JWT auth (`/api/*`) |
| `nexus-backend/requirements.txt` | Deps | fastapi, jose, passlib (partially unused) |
| **frontend/** | | |
| `frontend/package.json` | npm | `nexus-ide-client` — React 18, Vite 5, Monaco |
| `frontend/package-lock.json` | npm | Lockfile |
| `frontend/index.html` | HTML | Vite shell |
| `frontend/vite.config.js` | Config | Dev server :5173 |
| `frontend/postcss.config.js` | Config | PostCSS |
| `frontend/tailwind.config.js` | Config | Tailwind |
| `frontend/src/main.jsx` | React | Bootstrap |
| `frontend/src/App.jsx` | React | Main IDE UI → `127.0.0.1:8000/api` |
| `frontend/src/index.css` | CSS | Global styles |
| `frontend/src/components/FileTreeNode.jsx` | React | File tree |
| `frontend/src/components/TerminalArea.jsx` | React | WebSocket terminal |
| **nexus-frontend/** | | |
| `nexus-frontend/index.html` | HTML | Auth test UI → Render deployment URL |
| **portal/** | | |
| `portal/index.html` | HTML | Marketing Cloud Portal landing |
| **ai_nexus/** | | |
| `ai_nexus/README.md` | Docs | AI Nexus L4 Router product |
| `ai_nexus/package.json` | npm | Vite 6 + Express server |
| `ai_nexus/package-lock.json` | npm | Lockfile |
| `ai_nexus/.env.example` | Env | API key placeholders |
| `ai_nexus/.gitignore` | Git | Local ignores (product-only) |
| `ai_nexus/index.html` | HTML | Vite SPA shell |
| `ai_nexus/vite.config.ts` | Config | Vite |
| `ai_nexus/tsconfig.json` | Config | TypeScript |
| `ai_nexus/server.ts` | Node | Express API + dev Vite middleware |
| `ai_nexus/firebase-applet-config.json` | Secret | Firebase web config (committed `apiKey`) |
| `ai_nexus/firebase-blueprint.json` | Config | Firebase blueprint |
| `ai_nexus/firestore.rules` | Firebase | Firestore rules |
| `ai_nexus/metadata.json` | Config | Applet metadata |
| `ai_nexus/security_spec.md` | Docs | Security spec |
| `ai_nexus/privet-mir.txt` | Stray | Test file (“Привет мир”) |
| `ai_nexus/src/main.tsx` | React | Entry |
| `ai_nexus/src/App.tsx` | React | Main UI |
| `ai_nexus/src/index.css` | CSS | Styles |
| `ai_nexus/src/firebase.ts` | TS | Firebase init |
| `ai_nexus/src/types.ts` | TS | Types |
| `ai_nexus/src/context/AppContext.tsx` | React | App state |
| `ai_nexus/assets/.aistudio/.gitignore` | Git | Asset ignore |

**Absent at repo root:** `README.md`, `.gitignore`, `pyproject.toml`, `.cursorrules`, `AGENTS.md`, `.cursor/`

---

## Python Backends — Per-Tree Analysis

### `backend/` (port 8000)

- **Lines:** ~889 in single `main.py`
- **Role:** Local IDE API; proxies auth/billing/AI to `http://127.0.0.1:8080`
- **Storage:** `~/.nexus_ide_config.json` (tokens), `~/.nexus_ide_agent.log`
- **Routes:** `/api/auth/*`, `/api/billing/*`, `/api/files/*`, `/api/git/*`, `/api/db/*`, `/api/ai/chat`, `/api/ws/terminal`, etc.
- **All functions/classes are referenced** (via `@app` decorators or internal calls). No orphan `.py` modules.

### `nexus-cloud-server/` (port 8080)

- **Lines:** ~394 in `main.py`
- **Role:** SQLite users, JWT + refresh tokens, billing simulation, RouterAI proxy
- **DB:** `nexus_cloud_v2.db` (created at startup via SQLAlchemy)
- **All route handlers and models are used**

### `nexus-backend/` (deploy stub)

- **Lines:** 117 in `main.py`
- **Role:** Standalone in-memory auth for Render (`nexus-frontend` points to `https://nexus-backend-iwzv.onrender.com`)
- **Overlap:** Same concepts as `nexus-cloud-server` `/v1/auth/*` but different paths (`/api/*`), crypto (SHA-256 vs bcrypt), and **different `SECRET_KEY`**

---

## Dependency Analysis

### `backend/requirements.txt`

| Package | Used by imports / code |
|---------|------------------------|
| fastapi | Yes |
| uvicorn | Runtime (not imported) |
| pydantic | Yes |
| websockets | Yes (`WebSocket`) |
| httpx | Yes |

**Stdlib used but not listed:** `tkinter`, `sqlite3`, `asyncio`, `shutil`, `json`, `datetime` — expected.

**Missing from imports:** `subprocess` — **required but not imported** (bug).

### `nexus-cloud-server/requirements.txt`

| Package | Used |
|---------|------|
| fastapi | Yes |
| uvicorn | Runtime |
| pydantic | Yes |
| sqlalchemy | Yes |
| passlib | Yes (`CryptContext`) |
| pyjwt | Yes (`import jwt`) |
| httpx | Yes |

**Unused imports in code:** `os` (imported, never used), `List` from `typing` (never used).

### `nexus-backend/requirements.txt`

| Package | Listed | Actually used |
|---------|--------|---------------|
| fastapi | Yes | Yes |
| uvicorn | Yes | Runtime only |
| python-jose | Yes | Yes (`jose.jwt`) |
| passlib[bcrypt] | Yes | **No** — SHA-256 via `hashlib` |
| python-multipart | Yes | **No** — no `File`/`Form` uploads |
| email-validator | Yes | Yes (via `EmailStr`) |

**Unused imports in code:** `status` (fastapi), `secrets` (stdlib).

### Version drift

| Project | fastapi | uvicorn |
|---------|---------|---------|
| backend, nexus-cloud-server | 0.110.0 | 0.28.0 |
| nexus-backend | **0.136.3** | **0.48.0** |

### Frontend npm (`frontend/package.json`)

| Dependency | Used in `src/` |
|------------|----------------|
| react, react-dom | Yes |
| @monaco-editor/react | Yes (`Editor`, `DiffEditor`) |
| lucide-react | Yes |

All declared dependencies appear used.

### `ai_nexus/package.json`

| Dependency | Used |
|------------|------|
| react, react-dom | Yes |
| firebase | Yes (`firebase.ts`, context) |
| express, dotenv | Yes (`server.ts`) |
| motion | Yes (`App.tsx`) |
| recharts | Yes (`App.tsx`) |
| vite, @vitejs/plugin-react, @tailwindcss/vite | Build/dev |

**Note:** `vite` appears in both `dependencies` and `devDependencies` (redundant pin).

---

## Dead Code Detection

### Orphan Python modules

**None.** Each backend tree contains only `main.py`.

### Unused imports

| File | Unused |
|------|--------|
| `nexus-backend/main.py` | `status`, `secrets` |
| `nexus-cloud-server/main.py` | `os`, `List` |

### Unused functions

**None confirmed** in application code. FastAPI route handlers appear “unused” to naive static analysis because they are registered via decorators.

### Whole-directory redundancy

| Directory | Verdict |
|-----------|---------|
| `nexus-backend/` | **Functionally redundant** with `nexus-cloud-server` for auth; kept for Render deploy unless merged |

---

## Errors, Imports, and Runtime Risks

### Syntax

`python -m py_compile` on all three `main.py` files: **PASS** (syntax valid).

### Import paths

- No cross-package imports (`from backend.main` etc.).
- Each service runs with **cwd = its own folder**: `uvicorn main:app`.
- After Phase 3 restructure: `uvicorn app.main:app` from `backend/` and `nexus-cloud-server/`.

### Logic / runtime issues

| Location | Issue |
|----------|-------|
| `backend/main.py` | **Missing `import subprocess`** for git endpoints |
| `backend/main.py` | `except Exception: pass` swallows errors in logging/token I/O |
| `backend/main.py` | `tkinter` folder dialog fails on headless Linux/CI |
| `nexus-backend/main.py` | `datetime.utcnow()` deprecated in Python 3.12+ |
| `nexus-backend/main.py` | CORS `allow_origins=["*"]` + `allow_credentials=True` is invalid per browser spec |
| `nexus-cloud-server/main.py` | Top-up check **auto-pays** invoice on first poll (simulation) |
| `nexus-cloud-server/main.py` | `ROUTER_AI_MASTER_KEY` placeholder breaks real AI proxy |
| `nexus-frontend/index.html` | Hardcoded Render URL, not local backends |

---

## Secrets and Debug Settings

| Location | Finding |
|----------|---------|
| `nexus-backend/main.py:12` | Hardcoded `SECRET_KEY` (JWT) |
| `nexus-backend/main.py:19` | Fixed password salt `"nexus_salt"` |
| `nexus-cloud-server/main.py:17-19` | Placeholder `SECRET_KEY`, `ROUTER_AI_MASTER_KEY` |
| `ai_nexus/firebase-applet-config.json` | Committed Firebase `apiKey` |
| All three backends | CORS `allow_origins=["*"]` |

`backend/main.py` does **not** hardcode JWT secrets; tokens come from cloud + `~/.nexus_ide_config.json`.

---

## Config Consolidation

| Artifact | Status |
|----------|--------|
| `.cursorrules` | Absent |
| `AGENTS.md` | Absent (project root) |
| `.cursor/` | Absent |
| `NEXUSRULES.md` | **Single** agent rules file |

**Proposal:** Keep `NEXUSRULES.md` as canonical; optionally add `.cursor/rules/nexus.mdc` symlink/copy in Phase 2.

---

## Mixed Concerns (Manual Review)

| Item | Recommendation |
|------|----------------|
| `ai_nexus/` | Separate product; consider own repo |
| `portal/`, `nexus-frontend/` | Static prototypes; not IDE runtime |
| `nexus-backend/` vs `nexus-cloud-server/` | Unify auth or document deploy-only role |
| `nexus-cloud-server/.git/` | Nested git root — unify or submodule |
| `venv/` at root + `nexus-backend/venv/` | Gitignore; single env preferred |
| `nexus_cloud_v2.db` | Remove from VCS; gitignore `*.db` |
| `ai_nexus/privet-mir.txt` | Delete (stray) |

---

## Phase 2 Approval Checklist

Execute after approving this report:

- [ ] Add root [`.gitignore`](.gitignore) (`venv/`, `node_modules/`, `__pycache__/`, `*.db`, `.env`)
- [ ] Fix `backend` missing `subprocess` import
- [ ] Remove unused imports in `nexus-backend`, `nexus-cloud-server`
- [ ] Trim `nexus-backend/requirements.txt` (drop passlib, python-multipart)
- [ ] Move JWT/Router keys to `os.environ` with dev fallbacks
- [ ] Stop tracking `nexus_cloud_v2.db` (gitignore; keep local file)
- [ ] Delete `ai_nexus/privet-mir.txt`
- [ ] Document `nexus-backend` as Render deploy stub in README (optional)
- [ ] **Do not** delete `backend/` or `nexus-cloud-server/` without smoke test

---

## Phase 3 Prerequisites

| Item | Target |
|------|--------|
| Layout | `backend/app/main.py` + `routers/`; same for `nexus-cloud-server` |
| Entry | `uvicorn app.main:app` from each backend directory |
| Lint | `pyproject.toml` with `[tool.ruff]` |
| Frontend | No API path changes unless routes renamed |
| Cloud paths | `backend` → `CLOUD_SERVER_URL` + `/v1/...` unchanged |

**Ruff status before Phase 3:** Not configured.

---

*End of Phase 1 audit. Phases 2–3 implement approved items from this report.*

---

## Post-Implementation Notes (Phases 2–3 completed)

| Action | Status |
|--------|--------|
| Root `.gitignore` added | Done |
| `subprocess` import fixed in IDE backend | Done (via `app/routers/git.py`) |
| `nexus-backend` deps trimmed; env-based `SECRET_KEY` | Done |
| `nexus-cloud-server` env-based secrets | Done |
| `ai_nexus/privet-mir.txt` removed | Done |
| `backend/app/` package with routers | Done — entry: `uvicorn app.main:app` |
| `nexus-cloud-server/app/` package | Done |
| `nexus-backend/app/` package | Done |
| `pyproject.toml` + `ruff check` | Done (passing) |
| Import smoke test | `backend` 27 routes, `cloud` 12, `auth` 7 |
