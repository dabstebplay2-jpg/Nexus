# Web IDE Lite (`/ide/lite`)

**Статус: заморожен** (только критические исправления).

## Назначение

- Быстрый просмотр/правка при локальном `backend` на `:8000`
- Демо для гостей на Vercel (ограничено: нет терминала, нет доступа к диску сервера)

## Основной продукт

**[Nexus IDE Desktop](../nexus-desktop/README.md)** — VSCodium + OpenVSX + Nexus AI.

## Не планируется в Web Lite

- Extension Host / VSIX / OpenVSX
- Полноценный debugger, LSP, multi-root parity
- Паритет с Cursor в браузере

## Будущее (фаза 4)

При необходимости IDE в браузере — отдельный эпик: **OpenVSCode Server** или **code-server** на выделенном хосте, не развитие `IdeApp.jsx`.
