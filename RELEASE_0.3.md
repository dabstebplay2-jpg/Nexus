# Nexus 0.3 — Connected Account System

- `START_NEXUS.bat` теперь запускает Connected mode.
- Реальные аккаунты, подписки, биллинг и AI используют persistent production Cloud.
- Локальный IDE backend остаётся на `127.0.0.1:8000`.
- Vite `/api` proxy может переключаться через `NEXUS_DEV_CLOUD_TARGET`.
- Добавлен `START_NEXUS_LOCAL.bat` для изолированного локального Cloud.
- Добавлен `nexus.bat cloud-check`.
- Secrets не вшиваются в frontend.
