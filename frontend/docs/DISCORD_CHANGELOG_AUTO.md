# Автоматический ченджлог в Discord (#signal)

## Как это работает (автоматически)

1. Обновите **`src/data/changelog.json`** (новая запись первой в `entries`, версия в `package.json`).
2. **Commit + push в `main`**.
3. Пост в **#signal** уходит сам — `npm run changelog:notify` вручную не нужен.

| Триггер | Когда |
|--------|--------|
| **Vercel (основной)** | Production deploy после push: `build` → `changelog:notify:on-deploy` (только если в коммите менялся `changelog.json`) |
| **GitHub Actions** | Только вручную: Actions → Discord changelog → Run workflow |

Preview-деплои и коммиты без changelog **не** шлют пост в Discord.

Preview-деплои Vercel **не** шлют в Discord.

## Один раз: секрет в Vercel

1. [Vercel](https://vercel.com) → проект **frontend** → **Settings** → **Environment Variables**
2. Имя: `DISCORD_CHANGELOG_WEBHOOK_URL`
3. Значение: URL из `discord-webhook.local.json` (поле `url`)
4. Environment: **только Production**
5. Save → **Redeploy** production

## Один раз: секрет в GitHub (если репозиторий на GitHub)

```bash
npm run discord:sync-github
```

Или вручную: Repo → **Settings** → **Secrets** → `DISCORD_CHANGELOG_WEBHOOK_URL` = тот же URL, что на Vercel.

## Локально (по желанию)

```bash
npm run changelog:notify
```

Или полный цикл:

```bash
npm run deploy:prod
```

## Канал

Канал **#signal** — `channel_id` `1512122313670262985` (guild `1512107730427711498`). Все посты changelog идут только туда.

## Если вебхук удалён (404) или бот 401

1. Discord → **#signal** → настройки канала → **Интеграции** → **Вебхуки** → создать → скопировать URL.
2. Сохраните в `discord-webhook.local.json` (поле `url`).
3. `npm run discord:sync-vercel` — обновит переменную на Vercel (production).
4. `npm run changelog:notify` — проверка поста в #signal.

Альтернатива через бота: сброс токена в Developer Portal → `discord-bot.local.json` → `npm run discord:setup-webhook` → `npm run discord:sync-vercel`.
