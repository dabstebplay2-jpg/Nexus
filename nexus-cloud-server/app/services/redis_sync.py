"""Персистентность через Upstash Redis REST (снимок SQLite-таблиц)."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL, redis_persistence_enabled
from app.database import FxRateDB, InvoiceDB, SessionLocal, TransactionDB, UserDB

from app.services.detailed_log import get_logger, log_detail

logger = get_logger("redis")

_SNAPSHOT_KEY_V1 = "nexus:v1:db_snapshot"
_SNAPSHOT_KEY = "nexus:v2:db_snapshot"
_SNAPSHOT_VERSION = 2
_hook_installed = False


def _redis_client():
    from upstash_redis import Redis

    return Redis(url=UPSTASH_REDIS_REST_URL, token=UPSTASH_REDIS_REST_TOKEN)


def _serialize_dt(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _deserialize_dt(value: Any) -> Any:
    if value is None or not isinstance(value, str):
        return value
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            return dt.astimezone().replace(tzinfo=None)
        return dt
    except ValueError:
        return value


def _user_to_dict(u: UserDB) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "hashed_password": u.hashed_password,
        "google_sub": getattr(u, "google_sub", None),
        "telegram_id": getattr(u, "telegram_id", None),
        "telegram_username": getattr(u, "telegram_username", None),
        "email_verified_at": _serialize_dt(getattr(u, "email_verified_at", None)),
        "auth_methods": getattr(u, "auth_methods", None),
        "subscription_tier": u.subscription_tier,
        "balance": u.balance,
        "polza_api_key_encrypted": getattr(u, "polza_api_key_encrypted", None),
        "polza_user_id": getattr(u, "polza_user_id", None),
        "polza_key_id": getattr(u, "polza_key_id", None),
        "polza_key_updated_at": _serialize_dt(getattr(u, "polza_key_updated_at", None)),
        "polza_connect_required": getattr(u, "polza_connect_required", None),
        "refresh_token": u.refresh_token,
        "subscription_period_start": _serialize_dt(u.subscription_period_start),
        "subscription_period_end": _serialize_dt(u.subscription_period_end),
        "created_at": _serialize_dt(u.created_at),
    }


def _user_from_dict(d: dict) -> UserDB:
    return UserDB(
        id=d["id"],
        email=d["email"],
        hashed_password=d.get("hashed_password"),
        google_sub=d.get("google_sub"),
        telegram_id=d.get("telegram_id"),
        telegram_username=d.get("telegram_username"),
        email_verified_at=_deserialize_dt(d.get("email_verified_at")),
        auth_methods=d.get("auth_methods"),
        subscription_tier=d.get("subscription_tier", "FREE"),
        balance=float(d.get("balance") or 0),
        routerai_api_key=d.get("routerai_api_key"),
        routerai_key_id=d.get("routerai_key_id"),
        polza_api_key_encrypted=d.get("polza_api_key_encrypted"),
        polza_user_id=d.get("polza_user_id"),
        polza_key_id=d.get("polza_key_id"),
        polza_key_updated_at=_deserialize_dt(d.get("polza_key_updated_at")),
        polza_connect_required=d.get("polza_connect_required"),
        refresh_token=d.get("refresh_token"),
        subscription_period_start=_deserialize_dt(d.get("subscription_period_start")),
        subscription_period_end=_deserialize_dt(d.get("subscription_period_end")),
        created_at=_deserialize_dt(d.get("created_at")),
    )


def _tx_to_dict(t: TransactionDB) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "amount": t.amount,
        "tx_type": t.tx_type,
        "description": t.description,
        "created_at": _serialize_dt(t.created_at),
    }


def _tx_from_dict(d: dict) -> TransactionDB:
    return TransactionDB(
        id=d["id"],
        user_id=d["user_id"],
        amount=float(d["amount"]),
        tx_type=d["tx_type"],
        description=d.get("description"),
        created_at=_deserialize_dt(d.get("created_at")),
    )


def _inv_to_dict(i: InvoiceDB) -> dict:
    return {
        "id": i.id,
        "user_id": i.user_id,
        "amount_rub": i.amount_rub,
        "credits_usd": i.credits_usd,
        "amount": i.amount,
        "status": i.status,
        "created_at": _serialize_dt(i.created_at),
    }


def _inv_from_dict(d: dict) -> InvoiceDB:
    return InvoiceDB(
        id=d["id"],
        user_id=d["user_id"],
        amount_rub=float(d.get("amount_rub") or d.get("amount") or 0),
        credits_usd=float(d.get("credits_usd") or 0),
        amount=float(d.get("amount") or d.get("amount_rub") or 0),
        status=d.get("status", "pending"),
        created_at=_deserialize_dt(d.get("created_at")),
    )


def _fx_to_dict(f: FxRateDB) -> dict:
    return {
        "rate_date": f.rate_date,
        "usd_rub": f.usd_rub,
        "source": f.source,
        "fetched_at": _serialize_dt(f.fetched_at),
    }


def _fx_from_dict(d: dict) -> FxRateDB:
    return FxRateDB(
        rate_date=d["rate_date"],
        usd_rub=float(d["usd_rub"]),
        source=d.get("source", "cbr"),
        fetched_at=_deserialize_dt(d.get("fetched_at")),
    )


def export_snapshot(db: Session) -> dict[str, Any]:
    return {
        "v": _SNAPSHOT_VERSION,
        "exported_at": datetime.utcnow().isoformat(),
        "users": [_user_to_dict(u) for u in db.query(UserDB).order_by(UserDB.id).all()],
        "transactions": [_tx_to_dict(t) for t in db.query(TransactionDB).order_by(TransactionDB.id).all()],
        "invoices": [_inv_to_dict(i) for i in db.query(InvoiceDB).all()],
        "fx_rates": [_fx_to_dict(f) for f in db.query(FxRateDB).all()],
    }


def _clear_tables(db: Session) -> None:
    db.query(TransactionDB).delete()
    db.query(InvoiceDB).delete()
    db.query(UserDB).delete()
    db.query(FxRateDB).delete()
    db.commit()


def import_snapshot(db: Session, data: dict[str, Any]) -> int:
    if not data or not data.get("users") and not data.get("transactions"):
        return 0
    _clear_tables(db)
    for row in data.get("users") or []:
        db.add(_user_from_dict(row))
    for row in data.get("transactions") or []:
        db.add(_tx_from_dict(row))
    for row in data.get("invoices") or []:
        db.add(_inv_from_dict(row))
    for row in data.get("fx_rates") or []:
        db.add(_fx_from_dict(row))
    db.commit()
    return len(data.get("users") or [])


def persist_snapshot_to_redis(db: Session | None = None) -> None:
    if not redis_persistence_enabled():
        return
    own = db is None
    if own:
        db = SessionLocal()
    try:
        payload = export_snapshot(db)
        raw = json.dumps(payload, ensure_ascii=False)
        client = _redis_client()
        client.set(_SNAPSHOT_KEY, raw)
        users_n = len(payload.get("users") or [])
        tx_n = len(payload.get("transactions") or [])
        inv_n = len(payload.get("invoices") or [])
        log_detail(
            logger,
            "UPSTASH: snapshot сохранён",
            users=users_n,
            transactions=tx_n,
            invoices=inv_n,
            key=_SNAPSHOT_KEY,
            bytes=len(raw),
        )
    except Exception as exc:
        logger.exception("Upstash persist failed: %s", exc)
        raise
    finally:
        if own:
            db.close()


def hydrate_from_redis() -> int:
    if not redis_persistence_enabled():
        return 0
    try:
        client = _redis_client()
        raw = client.get(_SNAPSHOT_KEY)
        snapshot_key = _SNAPSHOT_KEY
        if not raw:
            raw = client.get(_SNAPSHOT_KEY_V1)
            snapshot_key = _SNAPSHOT_KEY_V1
        if not raw:
            log_detail(logger, "UPSTASH: snapshot пуст", action="старт с чистой БД")
            return 0
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        data = json.loads(raw) if isinstance(raw, str) else raw
        db = SessionLocal()
        try:
            n = import_snapshot(db, data)
            log_detail(
                logger,
                "UPSTASH: snapshot загружен",
                users=n,
                transactions=len(data.get("transactions") or []),
                invoices=len(data.get("invoices") or []),
                exported_at=data.get("exported_at"),
                key=snapshot_key,
                version=data.get("v"),
            )
            return n
        finally:
            db.close()
    except Exception as exc:
        logger.exception("Upstash hydrate failed: %s", exc)
        return 0


def install_redis_commit_hook() -> None:
    global _hook_installed
    if _hook_installed or not redis_persistence_enabled():
        return

    @event.listens_for(Session, "after_commit")
    def _on_commit(_session: Session) -> None:
        try:
            persist_snapshot_to_redis(None)
        except Exception:
            logger.exception("Upstash sync after commit failed")

    _hook_installed = True
    logger.info("Upstash Redis persistence enabled (after_commit sync)")
