#!/usr/bin/env python3
"""Local mock CRM backed by stdlib sqlite3.

This is the ONLY writable store in the spine and it is deliberately a local
file opened by relative path inside the run directory. No CRM SDK is
imported, no credentials are read, nothing leaves the machine. Upserts are
idempotent on ``lead_id`` so replaying a run never duplicates a row.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

_SCHEMA = """
CREATE TABLE IF NOT EXISTS crm_leads (
    lead_id        TEXT PRIMARY KEY,
    masked_name    TEXT NOT NULL,
    source         TEXT NOT NULL,
    offer          TEXT NOT NULL,
    brief_sha256   TEXT NOT NULL,
    idempotency_key TEXT NOT NULL
);
"""


def _connect(db_path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.execute(_SCHEMA)
    return conn


def upsert_briefs(db_path: str | Path, briefs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mirror the approved briefs into the CRM: idempotently upsert each
    brief and reconcile by deleting any row whose lead is no longer in the
    incoming set (so a later rejection actually removes the lead). Returns
    the rows as written, sorted by lead_id, each with its idempotency key."""
    import spine_common as sc  # local import to avoid a cycle at module load

    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = _connect(db_path)
    rows: list[dict[str, Any]] = []
    try:
        keep_ids = [b["lead_id"] for b in briefs]
        placeholders = ",".join("?" for _ in keep_ids) or "''"
        conn.execute(
            f"DELETE FROM crm_leads WHERE lead_id NOT IN ({placeholders})",
            keep_ids,
        )
        for b in briefs:
            brief_sha = sc.sha256_obj(b)
            idem = sc.sha256_hex(f"{b['lead_id']}:{brief_sha}")
            conn.execute(
                """
                INSERT INTO crm_leads
                    (lead_id, masked_name, source, offer, brief_sha256, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(lead_id) DO UPDATE SET
                    masked_name=excluded.masked_name,
                    source=excluded.source,
                    offer=excluded.offer,
                    brief_sha256=excluded.brief_sha256,
                    idempotency_key=excluded.idempotency_key
                """,
                (b["lead_id"], b["masked_name"], b["source"], b["offer"], brief_sha, idem),
            )
        conn.commit()
        cur = conn.execute(
            "SELECT lead_id, masked_name, source, offer, brief_sha256, idempotency_key "
            "FROM crm_leads ORDER BY lead_id"
        )
        for r in cur.fetchall():
            rows.append(
                {
                    "lead_id": r[0],
                    "masked_name": r[1],
                    "source": r[2],
                    "offer": r[3],
                    "brief_sha256": r[4],
                    "idempotency_key": r[5],
                }
            )
    finally:
        conn.close()
    return rows


def count_rows(db_path: str | Path) -> int:
    conn = _connect(db_path)
    try:
        return int(conn.execute("SELECT COUNT(*) FROM crm_leads").fetchone()[0])
    finally:
        conn.close()
