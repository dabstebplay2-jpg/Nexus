# Nexus — монорепозиторий

Единый GitHub: [dabstebplay2-jpg/Nexus](https://github.com/dabstebplay2-jpg/Nexus)

| Папка | Деплой |
|-------|--------|
| `frontend/` | Vercel |
| `nexus-cloud-server/` | Render |
| `backend/` | только локально |

## После правок

```powershell
cd c:\nexus-ide
git checkout -b feature/my-change
git add -A
git commit -m "описание"
git push -u origin feature/my-change
# → Pull Request в main на GitHub
```

## Устаревшее (не использовать)

- `nexus-backend/` — старый прототип auth
- `nexus-frontend/`, `portal/` — заглушки

## Документация

- `nexus-cloud-server/docs/DEPLOYMENT_RU.md`
- `docs/RENDER_SETUP_RU.md`, `docs/DEPLOY_VERCEL.md`
- `nexus-cloud-server/docs/ADMIN_RENDER_RU.md`
