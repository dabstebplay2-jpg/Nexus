# Nexus AI + No-Code — объединённая версия

Дата объединения: 2026-08-09  
Frontend version: `0.2.0`

## Что было объединено

В исходном RAR лежали две кодовые базы:

1. `Nexus_Ai_site/` — основной Nexus: React/Vite frontend, FastAPI cloud, локальный IDE backend, Browser, Desktop, Spaces, Artifacts, auth, billing, connectors и AI.
2. `no-code/` — отдельный React/Vite AI no-code чат с собственными `/api/chat`, `/api/models` и `server/aiService.js`.

В этой версии **Nexus_Ai_site выбран основной платформой**, а активная продуктовая логика `no-code` встроена в него как No-Code Studio.

## Что изменено

### Новый раздел `/no-code`

Добавлен полноценный No-Code Studio внутри основного frontend Nexus.

Режимы:

- Авто
- Сайт под ключ
- Лендинг
- Портфолио
- UX-аудит
- No-code план
- Marketplace / WB / Ozon

### Единый AI backend

Старые runtime-endpoints второго проекта:

- `no-code/api/chat.js`
- `no-code/api/models.js`
- `no-code/server/aiService.js`

**не подключаются к production runtime** объединённого проекта.

No-Code Studio использует уже существующие Nexus endpoints и возможности:

- каталог моделей Nexus;
- тарифы и лимиты;
- авторизацию;
- Polza/OpenRouter routing;
- streaming;
- web search;
- вложения;
- пользовательскую память;
- облачную историю чатов;
- артефакты и существующую chat-инфраструктуру.

### Сохранение режима в истории

No-Code Studio записывает специальный скрытый `system`-контекст в сам диалог. Он не показывается как обычное сообщение, но сохраняется вместе с разговором.

Это означает, что диалог продолжает помнить выбранный сценарий после повторного открытия.

### Единая навигация

No-Code Studio добавлен в:

- основной sidebar;
- мобильные вкладки;
- AppModeNav;
- SiteNav;
- блок возможностей на главном экране.

## Основные новые файлы

```text
frontend/src/features/noCode/noCodeConfig.js
frontend/src/features/noCode/NoCodePresetBar.jsx
MERGE_NOTES.md
```

Основные изменённые файлы:

```text
frontend/src/App.jsx
frontend/src/pages/ChatPage.jsx
frontend/src/hooks/useNexusChat.js
frontend/src/components/layout/AppShell.jsx
frontend/src/components/AppModeNav.jsx
frontend/src/components/SiteNav.jsx
frontend/src/components/home/HomeFeatures.jsx
frontend/src/hooks/usePageTitle.js
frontend/src/data/changelog.json
frontend/package.json
frontend/package-lock.json
README.md
```


## Reliability + UI pass 0.2.0

После первого объединения выполнен отдельный проход по стабильности и интерфейсу:

- launcher запускает сервисы последовательно и проверяет готовность портов/health endpoint;
- Python-зависимости устанавливаются в локальный `venv`, а не поверх глобального Python;
- `nexus.bat` не требует изменения системной PowerShell ExecutionPolicy;
- гостевой режим не делает бессмысленный `/auth/profile` без сохранённых токенов;
- недоступный Cloud показывает ненавязчивый offline banner вместо падения всей оболочки;
- lazy routes повторно загружаются после stale chunk-cache и имеют отдельный route Error Boundary;
- dev-режим удаляет старые Nexus service-worker caches;
- обычный Chat и No-Code Studio имеют раздельные наборы диалогов/active conversation;
- sidebar, topbar, главная чата, composer, Studio presets и общие product-page primitives сделаны компактнее;
- тяжёлые постоянно движущиеся blur-orbs заменены на статичный фон с меньшей GPU-нагрузкой.

## Где лежит старый no-code проект

Оригинальные исходники сохранены для сравнения и возможного переноса отдельных идей:

```text
legacy/no-code-original/
```

Эта папка не участвует в runtime Nexus.

## Что специально удалено из чистой версии

Из итогового проекта не переносились генерируемые и локальные файлы:

- `node_modules/`
- `venv/`
- `.test-venv/`
- `dist/`
- `renderer-dist/`
- `__pycache__/`
- `.pytest_cache/`
- `.ruff_cache/`
- `.vite/`
- локальные `.env`
- локальная SQLite DB
- готовые `.exe/.msi/.vsix`

Это нужно пересобрать локально под свою ОС.

## Запуск после распаковки

Из корня проекта на Windows:

```bat
nexus.bat install
nexus.bat start
```

PowerShell execution policy менять не нужно: `nexus.bat` сам запускает внутренний `.ps1` с process-local `-ExecutionPolicy Bypass`. Для проверки состояния:

```bat
nexus.bat status
```

Запуск только frontend предназначен для отладки UI. Cloud API на `127.0.0.1:8080` при этом нужно запустить отдельно, иначе облачные API будут недоступны.

No-Code Studio:

```text
http://localhost:5173/no-code
```

## Проверка текущей версии

- Changelog validation: OK (`0.2.0` совпадает с package version).
- Все `148` JS/JSX-файлов в `frontend/src` прошли синтаксический parse-check через TypeScript parser: 0 ошибок.
- Проверены все относительные frontend imports: 0 отсутствующих файлов.
- `backend`, `nexus-cloud-server` и launcher Python helpers прошли `compileall`.
- JSON `package.json`, `package-lock.json`, `changelog.json` валиден.
- Полный Vite build в рабочем Linux-контейнере не является репрезентативной Windows-проверкой: clean archive не содержит `node_modules`, а доступный контейнерный npm registry не отдал одну транзитивную зависимость. На Windows зависимости ставятся `nexus.bat install` / `npm.cmd ci`.
