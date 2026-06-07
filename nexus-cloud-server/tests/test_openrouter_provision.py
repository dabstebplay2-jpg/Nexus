"""Per-user OpenRouter keys for FREE tier."""

from unittest.mock import AsyncMock, patch

import pytest

from app.database import UserDB
from app.services.credentials_vault import decrypt_secret, encrypt_secret
from app.services.openrouter_provision import (
    ensure_openrouter_key_for_user,
    openrouter_key_name_for_user,
    provision_openrouter_for_user,
    user_has_openrouter_key,
)


def test_openrouter_key_name_for_user(db_session):
    user = db_session.query(UserDB).filter(UserDB.id == 1).one()
    assert openrouter_key_name_for_user(user) == f"nexus-free-{user.id}"


@pytest.mark.asyncio
async def test_provision_skips_when_key_exists(db_session):
    user = db_session.query(UserDB).filter(UserDB.id == 1).one()
    user.subscription_tier = "FREE"
    user.openrouter_api_key_encrypted = encrypt_secret("sk-or-v1-test-user-key")
    user.openrouter_key_hash = "hash-abc"
    db_session.commit()

    with patch("app.services.openrouter_provision.openrouter_management_enabled", return_value=True):
        with patch(
            "app.services.openrouter_provision._openrouter_mgmt.create_api_key",
            new_callable=AsyncMock,
        ) as create_mock:
            ok = await provision_openrouter_for_user(user, db_session, force=False)

    assert ok is True
    create_mock.assert_not_awaited()
    assert user_has_openrouter_key(user)


@pytest.mark.asyncio
async def test_provision_creates_and_stores_key(db_session):
    user = db_session.query(UserDB).filter(UserDB.id == 1).one()
    user.subscription_tier = "FREE"
    user.openrouter_api_key_encrypted = None
    user.openrouter_key_hash = None
    db_session.commit()

    create_response = {
        "key": "sk-or-v1-new-user-key-xyz",
        "data": {"hash": "or-hash-123", "name": f"nexus-free-{user.id}"},
    }

    with patch("app.services.openrouter_provision.openrouter_management_enabled", return_value=True):
        with patch(
            "app.services.openrouter_provision._openrouter_mgmt.create_api_key",
            new_callable=AsyncMock,
            return_value=create_response,
        ):
            ok = await provision_openrouter_for_user(user, db_session, force=False)

    assert ok is True
    db_session.refresh(user)
    assert user.openrouter_key_hash == "or-hash-123"
    assert decrypt_secret(user.openrouter_api_key_encrypted) == "sk-or-v1-new-user-key-xyz"


@pytest.mark.asyncio
async def test_ensure_lazy_provision(db_session):
    user = db_session.query(UserDB).filter(UserDB.id == 1).one()
    user.subscription_tier = "FREE"
    user.openrouter_api_key_encrypted = None
    db_session.commit()

    user.openrouter_api_key_encrypted = encrypt_secret("sk-or-v1-lazy")
    user.openrouter_key_hash = "existing"
    db_session.commit()
    db_session.refresh(user)

    with patch("app.services.openrouter_provision.openrouter_management_enabled", return_value=True):
        with patch(
            "app.services.openrouter_provision.provision_openrouter_for_user",
            new_callable=AsyncMock,
            return_value=True,
        ) as prov_mock:
            key = await ensure_openrouter_key_for_user(user, db_session)

    assert key == "sk-or-v1-lazy"
    prov_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_ensure_calls_provision_when_missing(db_session):
    user = db_session.query(UserDB).filter(UserDB.id == 1).one()
    user.subscription_tier = "FREE"
    user.openrouter_api_key_encrypted = None
    db_session.commit()

    async def _fake_provision(u, db, *, force=False):
        set_key = encrypt_secret("sk-or-v1-provisioned")
        u.openrouter_api_key_encrypted = set_key
        u.openrouter_key_hash = "h1"
        db.commit()
        return True

    with patch("app.services.openrouter_provision.openrouter_management_enabled", return_value=True):
        with patch(
            "app.services.openrouter_provision.provision_openrouter_for_user",
            side_effect=_fake_provision,
        ):
            key = await ensure_openrouter_key_for_user(user, db_session)

    assert key == "sk-or-v1-provisioned"
