# Nexus 0.2 — repair & interface refresh

Дата: 2026-08-09

## Что ломало локальный запуск

В первой объединённой версии три процесса стартовали почти одновременно. Frontend мог открыться до Cloud API, а повторные launch-команды могли освобождать порт, который уже успел занять новый Vite. Отдельный запуск только frontend закономерно давал `ECONNREFUSED 127.0.0.1:8080`, потому что Vite proxy отправляет auth/billing/model API в Cloud.

В 0.2 launcher сначала освобождает порты один раз, затем запускает Cloud и ждёт `/v1/health`, запускает IDE Backend и ждёт порт, и только затем запускает Vite. Каждый сервис работает в отдельном остающемся открытым окне.

## Windows

Самый простой запуск:

```bat
START_NEXUS.bat
```

Или вручную:

```bat
nexus.bat install
nexus.bat start
nexus.bat status
```

PowerShell ExecutionPolicy менять не нужно.

## Reliability fixes

- отдельный Python `venv` для проекта;
- `npm.cmd` вместо `npm.ps1` внутри launcher;
- health/wait checks для 8080, 8000 и 5173;
- dev cleanup старых service worker/cache;
- retry одного stale lazy chunk после обновления;
- отдельный Error Boundary для каждой страницы;
- Cloud offline banner вместо полного падения оболочки;
- guest mode не вызывает `/auth/profile`, когда токенов нет;
- короткий timeout для startup profile request;
- `VITE_IDE_API_BASE` отделён от Cloud `VITE_API_BASE`;
- launcher мигрирует старую локальную IDE-настройку, если она осталась в `.env.local`;
- Chat и No-Code Studio больше не смешивают active conversation/history.

## UI refresh

- sidebar: 280 → 232 px;
- topbar: 56 → 48 px;
- уменьшены nav rows, профиль, controls и composer;
- гигантский wordmark на главной заменён компактным рабочим hero;
- убраны рекламные Browser-блоки из основного chat landing;
- новые prompt cards и Studio preset control;
- общие product-page заголовки и карточки уменьшены;
- heavy animated blur-orbs заменены статичным ambient background;
- новый mobile dock и единая визуальная иерархия.

## Проверки

- 148 frontend JS/JSX source files: syntax OK;
- relative imports: OK;
- Python compileall: OK;
- changelog validator: OK;
- project JSON: OK.
