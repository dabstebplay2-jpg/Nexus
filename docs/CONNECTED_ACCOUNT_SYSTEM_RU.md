# Nexus: подключение реальных аккаунтов, подписок и AI

## Главное

В Nexus есть два разных backend-компонента:

- `backend :8000` — локальный IDE/filesystem/terminal backend.
- `nexus-cloud-server` — аккаунты, JWT, подписки, биллинг, каталог моделей и AI.

Если запустить локальный `nexus-cloud-server :8080` без production `.env`, он создаёт отдельную SQLite-базу и не знает о пользователях production. Без `RESEND_API_KEY` email OTP не отправляется; без Polza-секретов не работает автоматическая выдача AI-ключей.

Поэтому `START_NEXUS.bat` в v0.3 работает в **CONNECTED mode**: локальный UI проксирует `/api` в persistent production Cloud. Никакие production secrets не хранятся во frontend.

## Connected mode

```bat
START_NEXUS.bat
```

По умолчанию production Cloud:

```text
https://nexus-cloud-ee17.onrender.com
```

Если адрес изменится, перед запуском можно задать:

```powershell
$env:NEXUS_PRODUCTION_CLOUD_URL='https://your-cloud.example.com'
.\START_NEXUS.bat
```

В этом режиме:

- старые и новые аккаунты используют одну production БД;
- email OTP отправляет production Resend;
- подписки обрабатывает production ЮKassa;
- после подтверждения оплаты Cloud активирует тариф и создаёт/обновляет per-user ключ Polza через MCP;
- модели запрашиваются через production `/v1/ai/models`;
- AI-запросы идут через production Cloud и никогда не раскрывают пользовательский Polza key браузеру.

## Что должно быть настроено на production Cloud (Render)

Секреты хранятся **только в Environment сервера**, не во frontend и не в git.

Минимум для production:

```env
ENV=production
NEXUS_CLOUD_SECRET_KEY=<СТАБИЛЬНЫЙ секрет 32+ символа>
NEXUS_CLOUD_DATABASE_URL=<persistent PostgreSQL URL>
NEXUS_CORS_ORIGINS=https://your-frontend.example.com

# Email OTP
NEXUS_EMAIL_AUTH_ENABLED=true
RESEND_API_KEY=<secret>
RESEND_FROM_EMAIL=Nexus <auth@your-verified-domain.example>

# Polza AI
POLZA_BACKEND_API_KEY=<server API key>
POLZA_MCP_TOKEN=<MCP token with keys.read + keys.write + billing.read>
POLZA_APP_NAME=Nexus

# Payments
YOOKASSA_SHOP_ID=<shop id>
YOOKASSA_SECRET_KEY=<secret>
YOOKASSA_RETURN_PATH=/pricing
NEXUS_FRONTEND_URL=https://your-frontend.example.com
NEXUS_BILLING_TEST_MODE=false
```

Если `NEXUS_CLOUD_SECRET_KEY` уже использовался production-сервером, **не заменяйте его** без миграции: он используется для JWT и шифрования сохранённых provider/connector secrets.

## Автоматические ключи Polza

Поток после оплаты:

1. ЮKassa подтверждает invoice.
2. Nexus активирует платный tier.
3. `provision_polza_for_user()` создаёт отдельный ключ `nexus-<email>` через Polza MCP.
4. Nexus сохраняет ключ в БД в зашифрованном виде.
5. `sync_polza_key_limit_after_payment()` выставляет лимит ключа по пулу оплаченного тарифа.
6. AI router достаёт этот ключ только на сервере и отправляет запрос в Polza.

Для ручного восстановления у платного пользователя уже существует endpoint `POST /v1/auth/repair-polza` и кнопка восстановления в настройках.

## Модели

Каталог платных моделей берётся из Polza `/models`, затем Nexus применяет свой curated catalog и ограничения тарифов. Запуск модели требует активной платной подписки и рабочего per-user Polza key.

Тариф FREE в текущей архитектуре использует OpenRouter. Если Free AI нужен, дополнительно настройте `OPENROUTER_API_KEY` и `OPENROUTER_MANAGEMENT_API_KEY`.

## Полностью локальный режим

```bat
START_NEXUS_LOCAL.bat
```

Он нужен для тестов. Чтобы в нём работали email/оплата/Polza, создайте `nexus-cloud-server/.env` из `.env.example` и заполните серверные secrets. Локальная БД находится в `nexus-cloud-server/nexus_cloud_v2.db` (если не задан другой `NEXUS_CLOUD_DATABASE_URL`).

**Production-аккаунты автоматически в локальную SQLite не копируются.** Если нужна та же база, используйте Connected mode или отдельную безопасную DB migration.
