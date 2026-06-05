# Nexus

Монорепозиторий: сайт (Vercel), облачный API (Render), локальный прокси IDE.

| Папка | Назначение | Деплой |
|-------|------------|--------|
| [`frontend/`](frontend/) | React/Vite — чат, тарифы, настройки | [Vercel](https://frontend-henna-tau-19.vercel.app) |
| [`nexus-cloud-server/`](nexus-cloud-server/) | FastAPI — auth, billing, Polza, админка | [Render](https://nexus-cloud-ee17.onrender.com) |
| [`backend/`](backend/) | Локальный прокси для IDE (не в проде) | — |

**Прод:** https://frontend-henna-tau-19.vercel.app · API: https://nexus-cloud-ee17.onrender.com

## Быстрый старт (два разработчика)

```powershell
git clone https://github.com/dabstebplay2-jpg/Nexus.git
cd Nexus

# Фронт
cd frontend
npm ci
npm run dev

# API (другой терминал)
cd nexus-cloud-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env   # заполнить секреты локально
uvicorn app.main:app --reload --port 8790
```

Админка: `nexus-cloud-server\scripts\start_local_admin.ps1`

## Git workflow

1. Ветка `feature/...` от `main`
2. PR в `main` (даже вдвоём — для ревью и истории)
3. Один push — и фронт, и API в одном PR, если фича сквозная

## Деплой

- **Vercel:** Root Directory = `frontend` (см. корневой `vercel.json`)
- **Render:** `rootDir: nexus-cloud-server` (см. `render.yaml`)

Подробнее: [`nexus-cloud-server/docs/DEPLOYMENT_RU.md`](nexus-cloud-server/docs/DEPLOYMENT_RU.md)

## Секреты

Не коммитить: `.env`, `discord-*.local.json`, ключи Polza/ЮKassa. Шаблоны — `*.env.example`.
