"""Public non-secret readiness information for the Nexus frontend and deploy checks."""

from fastapi import APIRouter

from app.config import (
    POLZA_BACKEND_API_KEY,
    POLZA_MCP_TOKEN,
    database_backend,
    database_is_ephemeral,
    email_auth_enabled,
    google_oauth_configured,
    openrouter_free_tier_enabled,
    resend_configured,
    telegram_bot_enabled,
    yookassa_enabled,
)

router = APIRouter(prefix="/v1/system", tags=["system"])


@router.get("/status")
def system_status() -> dict:
    database_persistent = not database_is_ephemeral()
    email_ready = email_auth_enabled() and resend_configured()
    google_ready = google_oauth_configured()
    telegram_ready = telegram_bot_enabled() and email_auth_enabled()
    billing_ready = yookassa_enabled()
    polza_inference_ready = bool(POLZA_BACKEND_API_KEY)
    polza_autoprovision_ready = bool(POLZA_MCP_TOKEN)
    free_ai_ready = openrouter_free_tier_enabled()

    issues: list[str] = []
    if not database_persistent:
        issues.append("persistent_database")
    if not (email_ready or google_ready or telegram_ready):
        issues.append("authentication_provider")
    if not billing_ready:
        issues.append("yookassa")
    if not polza_inference_ready:
        issues.append("polza_backend_key")
    if not polza_autoprovision_ready:
        issues.append("polza_mcp")

    return {
        "status": "ready" if not issues else "degraded",
        "service": "nexus-cloud",
        "database": {
            "backend": database_backend(),
            "persistent": database_persistent,
        },
        "auth": {
            "email": email_ready,
            "google": google_ready,
            "telegram": telegram_ready,
        },
        "billing": {"yookassa": billing_ready},
        "ai": {
            "polza_inference": polza_inference_ready,
            "polza_autoprovision": polza_autoprovision_ready,
            "free_openrouter": free_ai_ready,
        },
        "issues": issues,
    }
