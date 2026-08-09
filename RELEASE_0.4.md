# Nexus 0.4 — Production Connected

Главная цель релиза — единая production-система поверх существующих Vercel + Render без отдельной локальной базы аккаунтов.

- No-Code Studio остаётся частью Nexus.
- Обновлены Vercel → Render proxy defaults на текущий `nexus-cloud`.
- Email OTP показывается только когда доставка реально настроена.
- Добавлена диагностика production integrations без раскрытия секретов.
- Платные аккаунты автоматически восстанавливают отсутствующий Polza key при входе и перед AI inference.
- Render Blueprint больше не генерирует новый `NEXUS_CLOUD_SECRET_KEY`.
- Добавлены Resend / YooKassa / OpenRouter / Polza production knobs.
- Smoke test стал полностью read-only.
- Интерфейс стал компактнее: sidebar, header, composer, prompt cards и страницы.
- Улучшены offline/degraded states: UI не падает при временной недоступности Cloud.
