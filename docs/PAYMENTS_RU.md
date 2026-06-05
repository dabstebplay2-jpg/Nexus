# Подписки и дневная квота Nexus Pro (₽)

## Как сейчас

1. **Free** — регистрация без ключа RouterAI, **облачный ИИ недоступен**.
2. **Платный тариф** — только после **оплаченного** счёта `sub_TIER_xxx` (запись `paid` в БД).
3. Без оплаты `subscribe/check` возвращает **402** (если `NEXUS_BILLING_TEST_MODE=false` на сервере).
4. Тестовая кнопка «Подтвердить оплату» — **только** при `NEXUS_BILLING_TEST_MODE=true` и `VITE_BILLING_TEST_MODE=true` (локальная разработка).
5. На **проде** оба флага **false** — иначе это бесплатная раздача тарифов.

**Лимит ИИ:** месячный пул на 30 дней после оплаты (`billing_mode: monthly_quota`), не дневная квота × 30.

Пул считается от **фактической суммы счёта** в ₽: `amount_rub / курс_ЦБ × 92%` → лимит на персональном ключе RouterAI (`invoice.credits_usd`). Комиссия платформы Nexus — **8%**.

### Куда идут деньги (важно)

1. Пользователь платит **ЮKassa** → средства на **счёте магазина Nexus** (ЮMoney).
2. Nexus **не переводит** эти ₽ на routerai.ru автоматически — у RouterAI нет такого API.
3. **Владелец платформы** пополняет **депозит организации** на routerai.ru (аккаунт с мастер-ключом).
4. После webhook/проверки оплаты Nexus выставляет пользователю **лимит на суб-ключе** RouterAI ≈ 92% от оплаченной суммы (8% — комиссия платформы).
5. Расход токенов списывается с **депозита владельца**, а не с личного кошелька пользователя на routerai.ru.

Мониторинг для владельца: `GET /v1/local-admin/routerai/pool-status` (локальная админка).

### «Failed to fetch»

Обычно **backend :8000 не запущен** или страница открыта до старта серверов. Нужны три процесса: **8080** cloud, **8000** backend, **5173** frontend.

---

## Рекомендация для продакшена: ЮKassa

Для коммерческого сайта в РФ оптимален **[ЮKassa](https://yookassa.ru/)** (карты, СБП, ЮMoney, частично T-Pay).

### Архитектура

```
[Браузер] → POST /api/billing/subscribe (backend :8000)
         → cloud :8080 создаёт InvoiceDB (pending)
         → ЮKassa API: payment.create(amount_rub, return_url, metadata.invoice_id)
         ← confirmation_url (редирект пользователя)

[ЮKassa] → POST /v1/billing/yookassa/webhook (cloud)
         → invoice.status = paid, invoice.credits_usd = пул из amount_rub
         → activate_paid_tier() + provision_routerai_for_user(limit)
         → sync_routerai_key_limit()

[Владелец] → вручную пополняет депозит на routerai.ru (мастер-аккаунт)
```

### Почему webhook обязателен

Не полагаться на `return_url` («вернулся на сайт») — пользователь может закрыть вкладку.  
ЮKassa шлёт `payment.succeeded` на ваш URL; ответ **HTTP 200** в течение нескольких секунд.

### Два продукта в ЮKassa

| Тип | Когда | Сумма | После оплаты |
|-----|--------|-------|----------------|
| **Подписка (разовый платёж)** | Смена тарифа Hobby→Standard… | `tier.price_rub` (минус промо) | `subscription_tier` + лимит ключа RouterAI ≈ 92% суммы |
| **Пополнение** | — | — | **Отключено** (только подписка с месячным пулом) |

Автопродление (рекуррент) — отдельный этап: `save_payment_method` + cron, в ЮKassa это сложнее; на старте достаточно **ручного продления**.

### Переменные окружения (cloud)

```env
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_RETURN_URL=https://your-domain.ru/payment/return
YOOKASSA_WEBHOOK_URL=https://api.your-domain.ru/v1/billing/webhook/yookassa
```

### Библиотеки (Python, async)

- Официально: `yookassa` ([yookassa-sdk-python](https://github.com/yoomoney/yookassa-sdk-python))
- Async: `aioyookassa` / `async_yookassa` под FastAPI + httpx

### Пример создания платежа (логика)

```python
payment = await yookassa.create_payment(
    amount={"value": f"{amount_rub:.2f}", "currency": "RUB"},
    confirmation={"type": "redirect", "return_url": RETURN_URL},
    capture=True,
    description=f"Nexus Pro — {invoice_id}",
    metadata={"invoice_id": invoice_id, "user_id": str(user.id)},
)
# сохранить payment.id в InvoiceDB
return {"payment_url": payment.confirmation.confirmation_url}
```

### Webhook (упрощённо)

```python
@router.post("/webhook/yookassa")
async def yookassa_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    if body.get("event") != "payment.succeeded":
        return {"ok": True}
    invoice_id = body["object"]["metadata"]["invoice_id"]
    # идемпотентность: если invoice уже paid — 200 и exit
    await mark_invoice_paid(invoice_id, db)
    return {"ok": True}
```

### Безопасность

- Секреты только на **cloud**, не во frontend.
- Webhook: проверка IP ЮKassa и/или подписи.
- Идемпотентность по `invoice_id` + `payment.id`.
- Логировать все `TransactionDB`.

### Альтернативы

| Сервис | Плюсы | Минусы для Nexus |
|--------|-------|------------------|
| **ЮKassa** | ₽, СБП, привычно в РФ | Нужен ИП/ООО |
| **Robokassa** | Простое подключение | Старый UX |
| **Stripe** | Удобно глобально | ₽/РФ ограничены |
| **CloudPayments** | Подписки | Другой API |

### Этапы внедрения

1. **MVP (уже есть):** тестовая кнопка «Подтвердить оплату» — для разработки ИИ.
2. **ЮKassa sandbox:** реальный redirect + webhook на ngrok.
3. **Прод:** домен, HTTPS, webhook на cloud, убрать тест-кнопку или оставить только в `DEBUG`.
4. **Позже:** чеки 54-ФЗ (ЮKassa receipts), автопродление, промокоды.

### Где менять код в репозитории

- `nexus-cloud-server/app/routers/billing.py` — create_payment, webhook, убрать заглушку Stripe
- `nexus-cloud-server/app/services/yookassa_client.py` — новый модуль
- `backend/app/routers/billing.py` — прокси без изменений логики
- `frontend` — после `subscribe` открывать `payment_url` в той же вкладке; страница `/payment/return` с опросом статуса

---

## Чеклист перед приёмом платежей

- [ ] ИП/ООО и договор с ЮKassa
- [ ] HTTPS на API
- [ ] Webhook доступен из интернета
- [ ] Оферта и политика возвратов на сайте
- [ ] Курс ЦБ уже используется для отображения ₽
