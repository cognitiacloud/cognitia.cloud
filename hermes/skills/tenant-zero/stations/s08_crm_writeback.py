#!/usr/bin/env python3
"""Station 8 — Mock CRM writeback.

Writes approved closer briefs into the local sqlite mock CRM. Idempotent:
the rows-written artifact lists exactly what is in the store after the
upsert, so a second run produces the same artifact and the same row count.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import crm_store
import spine_common as sc


def run(
    intake: dict[str, Any],
    closer: dict[str, Any],
    db_path: str | Path,
) -> dict[str, Any]:
    rows = crm_store.upsert_briefs(db_path, closer["briefs"])
    out = {
        "tenant": intake["tenant"],
        "store": "local_sqlite:crm.sqlite",
        "rows_written": len(rows),
        "rows": rows,
        "idempotency_keys": [r["idempotency_key"] for r in rows],
    }
    sc.assert_no_unmasked_pii(out, "crm_writeback output")
    sc.require_schema(out, sc.CRM_WRITEBACK_SCHEMA, "crm_writeback")
    return out
