"""Optional Upstash-backed rate limits (shared across Render instances)."""

from __future__ import annotations

from app.config import UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL

_client = None


def _get_client():
    global _client
    if _client is None:
        from upstash_redis import Redis

        _client = Redis(url=UPSTASH_REDIS_REST_URL, token=UPSTASH_REDIS_REST_TOKEN)
    return _client


def redis_check_rate_limit(key: str, max_hits: int, window_sec: float) -> bool:
    """Fixed window counter. Returns True if allowed."""
    redis = _get_client()
    rk = f"nexus:rl:{key}"
    count = int(redis.incr(rk))
    if count == 1:
        redis.expire(rk, max(1, int(window_sec)))
    return count <= max_hits


def redis_retry_after_seconds(key: str, window_sec: float) -> int:
    redis = _get_client()
    rk = f"nexus:rl:{key}"
    ttl = redis.ttl(rk)
    if ttl is not None and int(ttl) > 0:
        return int(ttl)
    return max(1, int(window_sec))
