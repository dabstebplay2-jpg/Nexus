# Nexus Browser — Windows-приложение

Отдельное **десктопное** приложение (Electron + Chromium). Не сайт и не вкладка в браузере — скачал `.exe`, запустил.

## Скачать и запустить

### Вариант A — portable (без установки)

1. Скачайте `NexusBrowser-0.1.0-Portable.exe` из [GitHub Releases](https://github.com/dabstebplay2-jpg/Nexus/releases) (артефакт сборки CI)  
   или соберите локально (см. ниже).
2. Запустите файл двойным щелчком.
3. В боковой панели нажмите **Войти** — откроется окно входа **внутри приложения** (Google).

### Вариант B — установщик

1. Скачайте `NexusBrowser-0.1.0-Setup.exe`.
2. Установите, запустите **Nexus Browser** из меню Пуск.

После входа аккаунт Nexus общий с сайтом и IDE — отдельная регистрация не нужна.

## Сборка на своём ПК

```powershell
cd nexus-browser
npm ci
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist
```

Готовые файлы в `dist/`:

| Файл | Назначение |
|------|------------|
| `NexusBrowser-0.1.0-Portable.exe` | portable, можно с флешки |
| `NexusBrowser-0.1.0-Setup.exe` | установщик Windows |
| `win-unpacked/Nexus Browser.exe` | распакованная версия для отладки |

Или одной командой: `.\scripts\package-release.ps1`

## Разработка (только для разработчиков)

```powershell
npm run dev
```

Откроется окно Electron с hot-reload UI. Для обычных пользователей нужен только `npm run dist` или скачивание релиза.

## Возможности

- Мульти-вкладки, omnibox (URL + поиск)
- AI sidebar с контекстом страницы
- Agent mode (навигация, клики, ввод)
- Закладки и история (локально на ПК)

Документация: [docs/NEXUS_BROWSER_ARCH.md](../docs/NEXUS_BROWSER_ARCH.md)
