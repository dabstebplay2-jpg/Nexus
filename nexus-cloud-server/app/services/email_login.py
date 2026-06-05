"""Email OTP login: request code, verify, rate limits."""

from __future__ import annotations

import hashlib
import logging
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import (
    AUTH_OTP_LOCK_MINUTES,
    AUTH_OTP_MAX_VERIFY_ATTEMPTS,
    AUTH_OTP_REQUEST_EMAIL_WINDOW_SEC,
    AUTH_OTP_REQUEST_PER_EMAIL,
    AUTH_OTP_REQUEST_PER_IP,
    AUTH_OTP_REQUEST_IP_WINDOW_SEC,
    AUTH_OTP_TTL_SEC,
    NEXUS_AUTH_DEV_LOG_CODES,
    SECRET_KEY,
)
from app.database import LoginCodeDB
from app.services.auth_rate_limit import RateLimitExceeded, assert_rate_limit_async
from app.services.auth_session import ensure_user_after_otp, issue_tokens_and_setup, _add_auth_method
from app.services.resend_mailer import send_login_code_email

logger = logging.getLogger(__name__)

_GENERIC_SENT_MSG = "Если почта зарегистрирована, мы отправили код для входа."


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _code_hash(email: str, code: str) -> str:
    return hashlib.sha256(f"{SECRET_KEY}:{email}:{code}".encode()).hexdigest()


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


async def request_login_code(db: Session, email: str, client_ip: str | None) -> dict:
    email = normalize_email(email)
    if not email or "@" not in email:
        return {"message": _GENERIC_SENT_MSG}

    await assert_rate_limit_async(
        f"otp:email:{email}",
        AUTH_OTP_REQUEST_PER_EMAIL,
        AUTH_OTP_REQUEST_EMAIL_WINDOW_SEC,
        "Слишком много запросов кода на этот email. Подождите или введите код из последнего письма.",
    )

    ip = (client_ip or "unknown").strip()
    await assert_rate_limit_async(
        f"otp:ip:{ip}",
        AUTH_OTP_REQUEST_PER_IP,
        AUTH_OTP_REQUEST_IP_WINDOW_SEC,
        "Слишком много запросов с вашего IP. Подождите и попробуйте снова.",
    )

    code = _generate_code()
    code_hash = _code_hash(email, code)
    now = datetime.utcnow()
    expires = now + timedelta(seconds=AUTH_OTP_TTL_SEC)

    if NEXUS_AUTH_DEV_LOG_CODES:
        logger.warning("DEV OTP for %s: %s", email, code)

    sent = await send_login_code_email(email, code)
    if not sent and not NEXUS_AUTH_DEV_LOG_CODES:
        logger.error("OTP email not sent to %s (Resend failed or not configured)", email)
        raise ValueError(
            "Не удалось отправить письмо. Попробуйте через минуту или проверьте папку «Спам»."
        )

    # Replace stored code only after the message was sent (or dev log mode).
    db.query(LoginCodeDB).filter(LoginCodeDB.email == email).delete()
    db.add(
        LoginCodeDB(
            email=email,
            code_hash=code_hash,
            attempts=0,
            created_at=now,
            expires_at=expires,
        )
    )
    db.commit()
    return {"message": _GENERIC_SENT_MSG}


async def verify_login_code(db: Session, email: str, code: str) -> dict:
    email = normalize_email(email)
    code = (code or "").strip()
    if not email or len(code) != 6 or not code.isdigit():
        raise ValueError("Неверный email или код")

    row = (
        db.query(LoginCodeDB)
        .filter(LoginCodeDB.email == email)
        .order_by(LoginCodeDB.id.desc())
        .first()
    )
    if not row:
        raise ValueError(
            "Код недействителен или уже использован. Запросите новый код на email."
        )

    now = datetime.utcnow()
    if row.expires_at < now:
        db.delete(row)
        db.commit()
        raise ValueError("Код истёк. Запросите новый.")

    lock_until = row.created_at + timedelta(minutes=AUTH_OTP_LOCK_MINUTES)
    if row.attempts >= AUTH_OTP_MAX_VERIFY_ATTEMPTS and now < lock_until:
        raise ValueError("Слишком много попыток. Подождите 15 минут.")

    if _code_hash(email, code) != row.code_hash:
        row.attempts = (row.attempts or 0) + 1
        db.commit()
        raise ValueError(
            "Неверный код. Если вы запрашивали новый — используйте только последнее письмо."
        )

    db.delete(row)
    db.commit()

    user = await ensure_user_after_otp(db, email)
    _add_auth_method(user, "email_otp")
    if not user.email_verified_at:
        user.email_verified_at = now
    db.commit()

    payload = await issue_tokens_and_setup(db, user, mark_email_verified=True)
    is_google_mail = email.endswith("@gmail.com") or email.endswith("@googlemail.com")
    payload["has_google_linked"] = bool(getattr(user, "google_sub", None))
    payload["suggest_google_link"] = is_google_mail and not payload["has_google_linked"]
    return payload


def is_google_mailbox(email: str) -> bool:
    _, _, domain = normalize_email(email).partition("@")
    return domain in ("gmail.com", "googlemail.com")
