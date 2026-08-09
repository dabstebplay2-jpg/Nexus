# Nexus

> **Nexus 0.4 — Production Connected.** Существующие Vercel + Render `nexus-cloud`, единые аккаунты/подписки и автоматические Polza AI keys. См. [`PRODUCTION_SETUP_RU.md`](PRODUCTION_SETUP_RU.md).

## Быстрый запуск: реальные аккаунты, подписки и AI

`START_NEXUS.bat` запускает **CONNECTED mode**: интерфейс и IDE работают локально, а аккаунты, подписки, история биллинга и AI идут через постоянный production Cloud Nexus. Это рекомендуемый режим, если нужны уже созданные аккаунты.

```bat
START_NEXUS.bat
```

Для полностью изолированного локального теста используйте `START_NEXUS_LOCAL.bat`. Такой режим использует локальную SQLite и требует собственного `nexus-cloud-server/.env`, поэтому production-аккаунты в нём не появятся.

Подробности: [`docs/CONNECTED_ACCOUNT_SYSTEM_RU.md`](docs/CONNECTED_ACCOUNT_SYSTEM_RU.md).


Монорепозиторий: сайт (Vercel), облачный API (Render), локальный прокси IDE.

| Папка | Назначение | Деплой |
|-------|------------|--------|
| [`frontend/`](frontend/) | React/Vite — чат, No-Code Studio, тарифы, настройки | [Vercel](https://nexus-zeta-ruby-12.vercel.app) |
| [`nexus-cloud-server/`](nexus-cloud-server/) | FastAPI — auth, billing, Polza, админка | [Render](https://nexus-cloud-ee17.onrender.com) |
| [`nexus-desktop/`](nexus-desktop/) | Десктопная сборка IDE | локально |
| [`backend/`](backend/) | Локальный прокси для IDE (не в проде) | — |

**Прод:** настраивается после деплоя (см. [`docs/SOLO_HOSTING_RU.md`](docs/SOLO_HOSTING_RU.md))

## Локальный запуск (Windows)

Требования: Node.js 22.12+ и Python 3.10+.

Самый простой вариант после распаковки — двойной клик по `START_NEXUS.bat`. При первом запуске он сам вызовет установку зависимостей, затем поднимет все три сервиса. Для остановки есть `STOP_NEXUS.bat`.

Один Windows launcher для зависимостей, старта сервисов и диагностики. Рекомендуется запускать именно `nexus.bat`: он сам использует PowerShell `ExecutionPolicy Bypass` только для своего процесса, поэтому менять системную политику не нужно.

```bat
git clone https://github.com/dabstebplay2-jpg/Nexus.git
cd Nexus

nexus.bat install
nexus.bat start
nexus.bat status
```

Полезные команды:

```bat
nexus.bat stop
nexus.bat diagnose
nexus.bat admin
```

`install` создаёт локальный `venv`, ставит Python-зависимости изолированно и устанавливает frontend через `npm.cmd`. `start` запускает Cloud → ждёт его health-check → запускает IDE Backend → ждёт порт → запускает Frontend. Окна сервисов остаются открытыми, чтобы ошибка не исчезала сразу.

Отдельные сервисы:

```bat
nexus.bat cloud
nexus.bat backend
nexus.bat frontend
```

Важно: `frontend` без Cloud на `127.0.0.1:8080` откроет интерфейс, но аккаунт, тарифы, модели и облачные разделы будут офлайн. Для обычной разработки используйте `nexus.bat start`.

Сайт: http://localhost:5173  
Локальная админка: `nexus.bat admin` → http://127.0.0.1:8790/local-admin/

## No-Code Studio

В проект встроен второй проект `no-code` как полноценный раздел Nexus: `/no-code`. Он использует общую авторизацию, каталог моделей, облачный AI backend, лимиты и историю диалогов. Отдельный backend старого no-code приложения больше не нужен для runtime.

Доступные сценарии: сайт под ключ, лендинг, портфолио, UX-аудит, no-code архитектура и Marketplace. Подробности объединения — [`MERGE_NOTES.md`](MERGE_NOTES.md).

Оригинальные исходники второго проекта сохранены в [`legacy/no-code-original/`](legacy/no-code-original/) только для справки.

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
