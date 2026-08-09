# Nexus 0.4 verification

Проверки перед упаковкой 2026-08-09:

- `python -m compileall nexus-cloud-server/app backend` — OK.
- TypeScript parser (`allowJs + JSX`, no emit) — 148/148 `frontend/src` JS/JSX файлов без синтаксических ошибок.
- Относительные frontend imports — 0 отсутствующих целей.
- `node frontend/scripts/validate-changelog.mjs` — OK, 52 entries.
- JSON parsing всех project JSON (без generated dependencies) — OK.
- `render.yaml` и `nexus-cloud-server/render.yaml` — YAML OK.
- Старый Render hostname `nexus-cloud-bxcc.onrender.com` — удалён из исходников/документации.

Полный `npm ci && npm run build` в рабочем контейнере не выполнялся: внутреннее npm-зеркало среды не содержит часть tarball-зависимостей (`zwitch`). Это ограничение среды проверки, а не ошибка исходников. На Windows/Vercel используется обычный npm registry и committed `package-lock.json`.

Cloud pytest collection в рабочем контейнере также ограничена отсутствующими Python runtime-зависимостями (например `passlib`), которые устанавливаются из `requirements.txt` на Windows/Render.
