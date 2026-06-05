"""Connectors catalog and user connections."""

from __future__ import annotations

import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.connectors.catalog import get_catalog_entry, is_mvp_connector, list_catalog_entries, list_categories
from app.config import NEXUS_FRONTEND_URL
from app.database import UserDB, get_db
from app.security import get_current_user
from app.services.connectors.oauth_providers import create_connect_url, handle_oauth_callback
from app.services.connectors.oauth_state import pop_connector_oauth_state
from app.services.connectors.store import disconnect, get_connection, list_user_connections, set_enabled_for_chat, upsert_connection
from app.services.models_registry import tier_rank
from app.services.oauth_redirect import safe_oauth_redirect_base
from app.tiers import normalize_tier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/connectors", tags=["connectors"])


class ConnectorConnectBody(BaseModel):
    return_to: str | None = None


class DiscordWebhookBody(BaseModel):
    webhook_url: str = Field(max_length=512)
    channel_label: str | None = Field(None, max_length=128)


class ConnectorPatchBody(BaseModel):
    enabled_for_chat: bool


def _tier_allows_connector(user: UserDB, entry: dict) -> bool:
    required = normalize_tier(entry.get("required_tier") or "HOBBY")
    return tier_rank(user.subscription_tier) >= tier_rank(required)


def _connection_map(db: Session, user_id: int) -> dict[str, dict]:
    out = {}
    for row in list_user_connections(db, user_id):
        out[row.connector_id] = {
            "status": row.status,
            "account_label": row.account_label,
            "enabled_for_chat": bool(row.enabled_for_chat),
            "connected": True,
        }
    return out


@router.get("")
def list_connectors(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn_map = _connection_map(db, current_user.id)
    items = []
    for entry in list_catalog_entries():
        cid = entry["id"]
        merged = {**entry, "connected": cid in conn_map, "enabled_for_chat": False}
        if cid in conn_map:
            merged.update(conn_map[cid])
        merged["available"] = (
            not entry.get("coming_soon")
            and is_mvp_connector(cid)
            and _tier_allows_connector(current_user, entry)
        )
        items.append(merged)
    return {
        "categories": list_categories(),
        "connectors": items,
    }


@router.post("/{connector_id}/connect")
def start_connect(
    connector_id: str,
    body: ConnectorConnectBody | None = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = get_catalog_entry(connector_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Коннектор не найден")
    if entry.get("coming_soon"):
        raise HTTPException(status_code=400, detail="Коннектор пока недоступен")
    if not _tier_allows_connector(current_user, entry):
        raise HTTPException(status_code=403, detail="Недостаточный тариф для этого коннектора")

    if connector_id == "discord":
        return {
            "auth_type": "webhook",
            "message": "Укажите URL вебхука Discord (POST /v1/connectors/discord/webhook)",
        }

    return_to = body.return_to if body else None
    try:
        url = create_connect_url(
            db,
            user_id=current_user.id,
            connector_id=connector_id,
            return_to=return_to,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"auth_type": "oauth", "url": url}


@router.get("/{connector_id}/callback")
async def oauth_callback(
    connector_id: str,
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    base = safe_oauth_redirect_base(None)
    target_base = f"{base}/connectors/callback"
    if error:
        return RedirectResponse(f"{target_base}?error={quote(error)}&connector={quote(connector_id)}")
    if not code or not state:
        return RedirectResponse(f"{target_base}?error=missing_code&connector={quote(connector_id)}")
    try:
        user_id, cid, verifier, return_to = pop_connector_oauth_state(db, state)
    except ValueError as e:
        return RedirectResponse(f"{target_base}?error=oauth_state&connector={quote(connector_id)}")
    if cid != connector_id:
        return RedirectResponse(f"{target_base}?error=connector_mismatch&connector={quote(connector_id)}")
    try:
        label = await handle_oauth_callback(
            db,
            connector_id=connector_id,
            code=code,
            verifier=verifier,
            user_id=user_id,
        )
    except Exception as exc:
        logger.exception("connector callback failed: %s", exc)
        return RedirectResponse(f"{target_base}?error=oauth_failed&connector={quote(connector_id)}")
    front = safe_oauth_redirect_base(return_to)
    return RedirectResponse(
        f"{front}/connectors/callback?status=ok&connector={quote(connector_id)}&label={quote(label)}"
    )


@router.post("/discord/webhook")
def connect_discord_webhook(
    body: DiscordWebhookBody,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = body.webhook_url.strip()
    if not url.startswith("https://discord.com/api/webhooks/"):
        raise HTTPException(status_code=400, detail="Некорректный URL вебхука Discord")
    row = upsert_connection(
        db,
        user_id=current_user.id,
        connector_id="discord",
        credentials={"webhook_url": url},
        account_label=body.channel_label or "Discord webhook",
    )
    return {
        "connector_id": "discord",
        "account_label": row.account_label,
        "connected": True,
    }


@router.delete("/{connector_id}")
def remove_connection(
    connector_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not disconnect(db, current_user.id, connector_id):
        raise HTTPException(status_code=404, detail="Подключение не найдено")
    return {"ok": True}


@router.patch("/{connector_id}")
def patch_connection(
    connector_id: str,
    body: ConnectorPatchBody,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = set_enabled_for_chat(db, current_user.id, connector_id, body.enabled_for_chat)
    if not row:
        raise HTTPException(status_code=404, detail="Подключение не найдено")
    return {
        "connector_id": connector_id,
        "enabled_for_chat": bool(row.enabled_for_chat),
    }


@router.get("/status/summary")
def connectors_summary(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """For chat UI chips."""
    rows = list_user_connections(db, current_user.id)
    return {
        "connected": [
            {
                "id": r.connector_id,
                "label": r.account_label or r.connector_id,
                "enabled_for_chat": bool(r.enabled_for_chat),
            }
            for r in rows
        ]
    }
