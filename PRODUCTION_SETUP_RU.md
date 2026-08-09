# Nexus 0.4 — подключение существующих Vercel + Render

Эта версия рассчитана на уже существующие сервисы: **Vercel frontend** и Render **`nexus-cloud`**. Создавать новые проекты не требуется.

## 1. GitHub / deploy

- Vercel собирает `frontend/`.
- Render собирает `nexus-cloud-server/`.
- После push в ветку, подключённую к production, оба сервиса могут обновиться автоматически.

## 2. Render → nexus-cloud → Environment

Сохраните существующие значения. **Никогда не генерируйте заново `NEXUS_CLOUD_SECRET_KEY`**, если в базе уже есть пользователи/зашифрованные provider keys.

Обязательные production-переменные:

```env
ENV=production
NEXUS_CLOUD_SECRET_KEY=<СОХРАНИТЬ СТАРОЕ ЗНАЧЕНИЕ>
NEXUS_CLOUD_DATABASE_URL=<постоянный PostgreSQL URL>
NEXUS_CORS_ORIGINS=https://<ваш-production-vercel-domain>,https://nexus-5rcx7yus2-dabstebplay-9561-4078ce53.vercel.app
NEXUS_FRONTEND_URL=https://<ваш-production-vercel-domain>
NEXUS_OAUTH_REDIRECT_ORIGINS=https://<ваш-production-vercel-domain>,https://nexus-5rcx7yus2-dabstebplay-9561-4078ce53.vercel.app

NEXUS_EMAIL_AUTH_ENABLED=true
RESEND_API_KEY=<server secret>
RESEND_FROM_EMAIL=Nexus <auth@ваш-домен>

POLZA_BACKEND_API_KEY=<server secret>
POLZA_MCP_TOKEN=<server secret с правами на API keys>
POLZA_APP_NAME=Nexus

YOOKASSA_SHOP_ID=<server secret>
YOOKASSA_SECRET_KEY=<server secret>
NEXUS_BILLING_TEST_MODE=false
NEXUS_TESTING_MODE=false
```

Опционально для бесплатных AI-моделей Free:

```env
OPENROUTER_API_KEY=...
OPENROUTER_MANAGEMENT_API_KEY=...
NEXUS_FREE_OPENROUTER_DAILY_LIMIT=100
NEXUS_FREE_OPENROUTER_RPM=15
```

Google OAuth можно оставить вместе с email OTP:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://nexus-cloud-ee17.onrender.com/v1/auth/google/callback
```

## 3. Vercel

В коде `/api/*` проксируется в Render. Production-секреты Polza, Resend и ЮKassa во frontend **не добавлять**.

Если Vercel project settings используют Root Directory — оставьте `frontend`. Если проект уже успешно собирался из монорепозитория, не создавайте новый проект.

## 4. Что теперь происходит автоматически

1. Пользователь входит через email OTP / Google.
2. Старый пользователь находится в той же persistent DB.
3. После успешной оплаты ЮKassa активируется платный тариф.
4. Nexus автоматически создаёт/синхронизирует персональный Polza API key через MCP.
5. Если webhook/провайдер временно не успел создать ключ, ключ автоматически восстанавливается при следующем входе и перед первым AI-запросом.
6. `/v1/ai/models` возвращает каталог, разрешённый тарифом пользователя.

## 5. Проверка после deploy

На Windows из корня проекта:

```bat
CHECK_PRODUCTION.bat
```

Проверка только читает health/config/catalog/status и **не создаёт тестовые аккаунты, платежи или ключи**.

Публичный диагностический endpoint (без секретов):

```text
GET /v1/system/status
```

`status=ready` означает, что persistent DB, хотя бы один auth provider, ЮKassa, Polza inference и Polza autoprovision доступны по конфигурации.
