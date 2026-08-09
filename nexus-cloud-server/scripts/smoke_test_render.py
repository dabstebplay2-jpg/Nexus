#!/usr/bin/env python3
"""Read-only production smoke test. It never creates users or changes billing/provider state."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = os.environ.get("NEXUS_PRODUCTION_CLOUD_URL", "https://nexus-cloud-ee17.onrender.com")


def request(url: str):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "NexusSmoke/0.4"})
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = {"raw": raw[:500]}
        return exc.code, body
    except Exception as exc:
        return 0, {"error": str(exc)}


def check(name: str, condition: bool, detail="") -> bool:
    print(f"[{'OK' if condition else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    return condition


def main() -> int:
    base = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE).rstrip("/")
    print(f"Nexus production check: {base}\n")
    results: list[bool] = []

    code, health = request(f"{base}/v1/health?verbose=true")
    results.append(check("Cloud health", code == 200 and health.get("status") == "ok", f"HTTP {code}"))

    code, status = request(f"{base}/v1/system/status")
    ready = code == 200 and status.get("status") == "ready"
    results.append(check("Production integrations", ready, ", ".join(status.get("issues") or []) or f"HTTP {code}"))

    code, auth = request(f"{base}/v1/auth/config")
    has_auth = bool(auth.get("google_oauth_enabled") or auth.get("email_auth_enabled") or auth.get("telegram_auth_enabled"))
    results.append(check("Authentication provider", code == 200 and has_auth, f"HTTP {code}"))

    code, catalog = request(f"{base}/v1/billing/catalog")
    results.append(check("Billing catalog", code == 200 and bool(catalog.get("tiers")), f"HTTP {code}"))

    code, _ = request(f"{base}/v1/ai/models")
    results.append(check("AI route protected", code in (401, 403), f"HTTP {code}"))

    print(f"\nPassed {sum(results)}/{len(results)} checks")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
