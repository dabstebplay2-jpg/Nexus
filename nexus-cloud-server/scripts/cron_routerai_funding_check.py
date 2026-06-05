#!/usr/bin/env python3
"""Render Cron: проверка депозита RouterAI и ops-алерт в Discord."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=True)

from app.database import SessionLocal, migrate_schema
from app.services.routerai_funding_cron import run_routerai_funding_check


async def main() -> int:
    migrate_schema()
    db = SessionLocal()
    try:
        result = await run_routerai_funding_check(db)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("alert_error"):
            return 1
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
