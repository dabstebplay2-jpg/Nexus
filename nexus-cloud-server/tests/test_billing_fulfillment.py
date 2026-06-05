from types import SimpleNamespace

from app.services.billing_fulfillment import invoice_tier_from_id, resolve_invoice_tier


def test_invoice_tier_from_id():
    assert invoice_tier_from_id("sub_PRO_a1b2c3d4") == "PRO"
    assert invoice_tier_from_id("sub_ULTRA_abc") == "ULTRA"
    assert invoice_tier_from_id("sub_HOBBY_abc123") == "HOBBY"


def test_resolve_invoice_tier_prefers_stored_column():
    inv = SimpleNamespace(id="sub_STANDARD_old", subscription_tier="HOBBY")
    assert resolve_invoice_tier(inv) == "HOBBY"
