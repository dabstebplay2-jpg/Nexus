"""Каталог моделей с Polza.ai GET /models (кэш + авто-обновление)."""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Any
from urllib.parse import quote

import httpx

from app.config import POLZA_BASE_URL
from app.curated_models import (
    CATALOG_VERSION,
    COST_SEGMENT_ORDER,
    apply_curated_catalog,
    curated_ids_union,
)
from app.config import is_testing_mode
from app.services import openrouter_models as or_models
from app.tiers import normalize_tier, tier_allows_ai, tier_uses_openrouter_free
from app.vision_capabilities import apply_vision_metadata, build_vision_guide

logger = logging.getLogger(__name__)

MODELS_CACHE_TTL = int(os.environ.get("NEXUS_MODELS_CACHE_TTL", "1800"))
MODELS_PER_TIER_DISPLAY = int(os.environ.get("NEXUS_MODELS_PER_TIER", "12"))
MAX_MODELS_FOR_USER = int(os.environ.get("NEXUS_MODELS_MAX_VISIBLE", "48"))

TIER_RANK = {"FREE": 0, "HOBBY": 1, "STANDARD": 2, "PRO": 3, "ULTRA": 4}
TIER_ORDER = ["HOBBY", "STANDARD", "PRO", "ULTRA"]
TIER_MARKETING_LABEL = {
    "HOBBY": "Hobby",
    "STANDARD": "Standard",
    "PRO": "Pro",
    "ULTRA": "Ultra",
}

# Потолок доступа к моделям по min_tier (ранг).
# HOBBY — только дешёвый сегмент.
# STANDARD — только cheap + medium (без Pro-моделей).
# PRO / ULTRA — полный каталог.
TIER_MODEL_CEILING = {
    "FREE": 0,
    "HOBBY": 1,
    "STANDARD": 2,
    "PRO": 4,
    "ULTRA": 4,
}

_SKIP_ID_PARTS = re.compile(
    r"(embed|embedding|dall-e|flux|stable-diffusion|/image|moderation|tts|whisper)",
    re.I,
)

_cache: dict[str, Any] = {
    "fetched_at": 0.0,
    "all_text": [],
    "chat_models": [],
    "research_models": [],
    "media_models": [],
    "by_id": {},
    "curated_ids": set(),
}


def tier_rank(tier: str | None) -> int:
    return TIER_RANK.get(normalize_tier(tier), 0)


def effective_model_ceiling(subscription_tier: str) -> int:
    """Максимальный ранг min_tier модели, доступной на подписке."""
    return TIER_MODEL_CEILING.get(normalize_tier(subscription_tier), 0)


def _tier_label(tier_id: str) -> str:
    t = normalize_tier(tier_id)
    return TIER_MARKETING_LABEL.get(t, t.title())


def _lock_message(subscription_tier: str, min_tier: str) -> str:
    label = _tier_label(min_tier)
    ceiling = effective_model_ceiling(subscription_tier)
    if ceiling <= 0:
        return f"Нужна подписка {label}"
    return f"Нужен тариф {label} или выше"


def _model_list_item(subscription_tier: str, m: dict) -> dict:
    user_rank = tier_rank(subscription_tier)
    model_band = tier_rank(m.get("min_tier", "ULTRA"))
    min_tier = normalize_tier(m.get("min_tier", "ULTRA"))
    allowed = True if is_testing_mode() else model_allowed(subscription_tier, m["id"])
    seg_label = m.get("cost_segment_label") or m.get("min_tier", "")
    desc = m.get("description") or ""
    hint = m.get("price_hint") or ""
    if hint and hint not in desc:
        desc = f"{desc} · {hint}".strip(" ·")
    enriched = apply_vision_metadata(m)
    item = {
        **enriched,
        "description": desc[:320],
        "locked": not allowed,
        "required_tier": min_tier,
        "required_tier_label": _tier_label(min_tier),
        "lock_message": None if allowed else _lock_message(subscription_tier, min_tier),
        "tier_label": m["min_tier"].title(),
        "is_latest": True,
        "cost_band": m.get("cost_segment") or m["min_tier"],
        "usage_hint": None,
        "badge": seg_label or None,
    }
    if allowed:
        if user_rank == 2 and model_band == 2:
            item["usage_hint"] = "recommended"
            item["badge"] = "Оптимально"
        elif user_rank == 1 and model_band == 1:
            item["usage_hint"] = "recommended"
    return item


def _price_usd_per_1m(prompt: float, completion: float) -> float:
    return (float(prompt or 0) + float(completion or 0)) * 1_000_000


def _is_chat_model(raw: dict) -> bool:
    mid = (raw.get("id") or "").lower()
    if _SKIP_ID_PARTS.search(mid):
        return False
    arch = raw.get("architecture") or {}
    outputs = arch.get("output_modalities") or []
    if outputs and "text" not in outputs:
        return False
    modality = (arch.get("modality") or "").lower()
    if modality and "text" not in modality:
        return False
    if raw.get("expiration_date"):
        return False
    return bool(mid)


def _normalize(raw: dict) -> dict:
    pricing = raw.get("pricing") or {}
    prompt = float(pricing.get("prompt") or 0)
    completion = float(pricing.get("completion") or 0)
    provider = (raw.get("id") or "").split("/")[0] if "/" in (raw.get("id") or "") else "unknown"
    ctx = int(raw.get("context_length") or 0)
    arch = raw.get("architecture") or {}
    input_mod = list(arch.get("input_modalities") or [])
    output_mod = list(arch.get("output_modalities") or [])
    supports_vision = "image" in input_mod
    supports_image_gen = "image" in output_mod
    return {
        "id": raw["id"],
        "name": raw.get("name") or raw["id"],
        "provider": provider.replace("-", " ").title(),
        "description": (raw.get("description") or "")[:280],
        "context_k": max(1, ctx // 1000) if ctx else 0,
        "created": int(raw.get("created") or 0),
        "multimodal": supports_vision,
        "input_modalities": input_mod,
        "output_modalities": output_mod,
        "supports_vision": supports_vision,
        "supports_image_gen": supports_image_gen,
        "price_1m_usd": round(_price_usd_per_1m(prompt, completion), 6),
        "pricing": {"prompt": prompt, "completion": completion},
        "tags": [],
    }


def _assign_min_tiers(models: list[dict]) -> None:
    if not models:
        return
    sorted_by_price = sorted(models, key=lambda m: m["price_1m_usd"])
    n = len(sorted_by_price)
    cuts = [int(n * 0.25), int(n * 0.50), int(n * 0.75)]
    for i, m in enumerate(sorted_by_price):
        if i < cuts[0]:
            m["min_tier"] = "HOBBY"
        elif i < cuts[1]:
            m["min_tier"] = "STANDARD"
        elif i < cuts[2]:
            m["min_tier"] = "PRO"
        else:
            m["min_tier"] = "ULTRA"


def _build_curated(models: list[dict]) -> set[str]:
    by_tier: dict[str, list[dict]] = {t: [] for t in TIER_ORDER}
    for m in models:
        by_tier[m["min_tier"]].append(m)
    curated: set[str] = set()
    for tier in TIER_ORDER:
        for m in sorted(by_tier[tier], key=lambda x: x["created"], reverse=True)[:MODELS_PER_TIER_DISPLAY]:
            curated.add(m["id"])
    return curated


async def _fetch_polza_models() -> list[dict]:
    url = f"{POLZA_BASE_URL.rstrip('/')}/models"
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.get(url)
    if response.status_code != 200:
        raise RuntimeError(f"Polza /models: {response.status_code}")
    data = response.json().get("data", [])
    return data if isinstance(data, list) else []


async def refresh_models_cache(*, force: bool = False) -> None:
    now = time.time()
    if not force and _cache["all_text"] and (now - _cache["fetched_at"]) < MODELS_CACHE_TTL:
        return
    try:
        raw_list = await _fetch_polza_models()
    except Exception as exc:
        logger.error("Polza models fetch failed: %s", exc)
        if _cache["all_text"]:
            return
        raise
    all_norm = [_normalize(r) for r in raw_list if (r.get("id") or "").strip()]
    chat_list, research_list, media_list = apply_curated_catalog(all_norm)
    _cache["chat_models"] = chat_list
    _cache["research_models"] = research_list
    _cache["media_models"] = media_list
    _cache["all_text"] = chat_list
    combined = chat_list + research_list + media_list
    by_id: dict[str, dict] = {}
    for m in combined:
        by_id[m["id"]] = m
        fid = m.get("family_id")
        if fid and fid != m["id"]:
            by_id[fid] = m
        std = m.get("model_id_standard")
        th = m.get("model_id_thinking")
        if std:
            by_id[std] = m
        if th:
            by_id[th] = m
    _cache["by_id"] = by_id
    _cache["curated_ids"] = curated_ids_union(chat_list, research_list, media_list)
    _cache["fetched_at"] = now


def get_model(model_id: str) -> dict | None:
    return _cache["by_id"].get(model_id)


def model_allowed(subscription_tier: str, model_id: str) -> bool:
    mid = (model_id or "").strip()
    if not mid:
        return False
    if tier_uses_openrouter_free(subscription_tier):
        if is_testing_mode():
            return or_models.free_model_allowed(mid) or get_model(mid) is not None
        return or_models.free_model_allowed(mid)
    if is_testing_mode():
        return get_model(mid) is not None
    if not tier_allows_ai(subscription_tier):
        return False
    m = get_model(mid)
    if not m:
        return False
    ceiling = effective_model_ceiling(subscription_tier)
    if ceiling <= 0:
        return False
    return tier_rank(m.get("min_tier", "ULTRA")) <= ceiling


def model_access_detail(subscription_tier: str, model_id: str) -> dict:
    mid = (model_id or "").strip()
    if tier_uses_openrouter_free(subscription_tier):
        m = or_models.get_free_model(mid)
        if not m:
            return {
                "allowed": False,
                "reason": "unknown_model",
                "upgrade_hint": "Модель недоступна на Free. Выберите бесплатную модель или оформите Hobby.",
            }
        return {
            "allowed": True,
            "min_tier": "FREE",
            "required_tier_label": "Free",
            "user_tier": "FREE",
            "ceiling_tier": "FREE",
            "upgrade_hint": None,
            "lock_message": None,
        }
    m = get_model(mid) if mid else None
    if not m:
        logger.warning(
            "[MODELS: miss] model_id=%r cache_ids=%d fetched_at=%s",
            mid,
            len(_cache.get("by_id") or {}),
            _cache.get("fetched_at"),
        )
        return {
            "allowed": False,
            "reason": "unknown_model",
            "upgrade_hint": "Модель не найдена в каталоге Nexus.",
        }
    min_tier = normalize_tier(m.get("min_tier", "HOBBY"))
    allowed = model_allowed(subscription_tier, mid)
    ceiling = effective_model_ceiling(subscription_tier)
    upgrade_hint = None if allowed else _lock_message(subscription_tier, min_tier)
    return {
        "allowed": allowed,
        "min_tier": min_tier,
        "required_tier_label": _tier_label(min_tier),
        "user_tier": normalize_tier(subscription_tier),
        "ceiling_tier": TIER_ORDER[ceiling - 1] if ceiling > 0 else "FREE",
        "upgrade_hint": upgrade_hint,
        "lock_message": upgrade_hint,
    }


def _sort_catalog_models(models: list[dict]) -> list[dict]:
    seg_index = {s: i for i, s in enumerate(COST_SEGMENT_ORDER)}
    models.sort(
        key=lambda x: (
            tier_rank(x.get("min_tier")),
            seg_index.get(x.get("cost_segment"), 9),
            x.get("price_1m_usd", 0),
            -int(x.get("quality_score") or 0),
            -x.get("created", 0),
        )
    )
    return models


def _catalog_models_for_display(subscription_tier: str, pool: list[dict]) -> list[dict]:
    """Полный каталог для UI: недоступные модели помечены locked + required_tier."""
    if not pool:
        return []
    out = [_model_list_item(subscription_tier, m) for m in pool]
    return _sort_catalog_models(out)


def _usable_models(catalog: list[dict]) -> list[dict]:
    return [m for m in catalog if not m.get("locked")]


async def list_models_for_user(subscription_tier: str) -> list[dict]:
    if tier_uses_openrouter_free(subscription_tier):
        return await or_models.list_chat_models_for_free_tier()
    await refresh_models_cache()
    return _catalog_models_for_display(subscription_tier, _cache.get("chat_models") or [])


async def list_research_models_for_user(subscription_tier: str) -> list[dict]:
    if tier_uses_openrouter_free(subscription_tier):
        return await or_models.list_research_models_for_free_tier()
    await refresh_models_cache()
    return _catalog_models_for_display(subscription_tier, _cache.get("research_models") or [])


async def list_media_models_for_user(subscription_tier: str) -> list[dict]:
    if tier_uses_openrouter_free(subscription_tier):
        return await or_models.list_media_models_for_free_tier()
    await refresh_models_cache()
    return _catalog_models_for_display(subscription_tier, _cache.get("media_models") or [])


async def list_usable_models_for_user(subscription_tier: str) -> list[dict]:
    catalog = await list_models_for_user(subscription_tier)
    return _usable_models(catalog)


async def get_default_model(subscription_tier: str, *, prefer: str = "balanced") -> str:
    if tier_uses_openrouter_free(subscription_tier):
        return await or_models.get_default_free_model(prefer=prefer)
    models = await list_usable_models_for_user(subscription_tier)
    if not models:
        await refresh_models_cache(force=True)
        models = await list_usable_models_for_user(subscription_tier)
    if not models:
        return "deepseek/deepseek-v4-flash"
    if prefer == "cheap":
        return min(models, key=lambda m: m["price_1m_usd"])["id"]
    if prefer == "premium":
        # Дорогие модели — но только из разрешённого потолка
        drain = [m for m in models if m.get("usage_hint") == "premium_drain"]
        pool = drain if drain else models
        return max(pool, key=lambda m: (tier_rank(m["min_tier"]), m.get("price_1m_usd", 0)))["id"]
    # balanced: предпочитаем «оптимальные», не сжигаем кредиты по умолчанию
    recommended = [m for m in models if m.get("usage_hint") == "recommended"]
    if recommended:
        return max(recommended, key=lambda m: m.get("created", 0))["id"]
    user_rank = tier_rank(subscription_tier)
    nominal = [m for m in models if tier_rank(m["min_tier"]) <= user_rank]
    if nominal:
        return max(nominal, key=lambda m: m.get("created", 0))["id"]
    return models[0]["id"]


async def model_access_detail_cached(subscription_tier: str, model_id: str) -> dict:
    """Проверка доступа с подгрузкой каталога (важно для cold start / нескольких инстансов)."""
    if tier_uses_openrouter_free(subscription_tier):
        await or_models.refresh_free_models_cache()
        detail = model_access_detail(subscription_tier, model_id)
        if detail.get("reason") == "unknown_model":
            await or_models.refresh_free_models_cache(force=True)
            detail = model_access_detail(subscription_tier, model_id)
        return detail
    await refresh_models_cache()
    detail = model_access_detail(subscription_tier, model_id)
    if detail.get("reason") == "unknown_model":
        await refresh_models_cache(force=True)
        detail = model_access_detail(subscription_tier, model_id)
    return detail


def get_pricing_for_billing(model_id: str) -> dict | None:
    m = get_model(model_id)
    if not m:
        return None
    p = m.get("pricing") or {}
    return {"input": p.get("prompt"), "output": p.get("completion")}


async def vision_guide_for_user(subscription_tier: str) -> dict:
    chat = await list_models_for_user(subscription_tier)
    research = await list_research_models_for_user(subscription_tier)
    media = await list_media_models_for_user(subscription_tier)
    return build_vision_guide(chat, research, media)


async def catalog_meta() -> dict:
    await refresh_models_cache()
    meta = {
        "source": "polza",
        "total_chat_models": len(_cache["all_text"]),
        "curated_count": len(_cache.get("chat_models") or []),
        "research_count": len(_cache.get("research_models") or []),
        "media_count": len(_cache.get("media_models") or []),
        "cached_at": _cache["fetched_at"],
        "cache_ttl_sec": MODELS_CACHE_TTL,
        "tier_ceilings": {
            k: TIER_ORDER[v - 1] if v > 0 else "NONE" for k, v in TIER_MODEL_CEILING.items()
        },
        "catalog_version": CATALOG_VERSION,
        "access_notes": {
            "HOBBY": "Только сегмент «Дешёвые» (июнь 2026).",
            "STANDARD": "Дешёвые + Средние + Дорогие (Pro-модели — высокий расход).",
            "PRO": "Весь кураторский каталог, включая «Очень дорогие».",
            "ULTRA": "Полный кураторский каталог без ограничений.",
            "FREE": "Бесплатные модели OpenRouter (нулевая цена).",
        },
    }
    free_meta = await or_models.catalog_meta_free()
    meta["openrouter_free"] = free_meta
    return meta
