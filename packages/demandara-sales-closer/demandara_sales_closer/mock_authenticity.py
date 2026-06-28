from __future__ import annotations

"""Local-only mock approval authenticity scaffolding.

This module is deliberately fake/local/mock-only test scaffolding.
It is not a real signature system, not real reviewer identity, not real
approval authenticity, not production proof, not sandbox/live readiness,
not controlled-live readiness, and not shipped functionality.

Agent readiness recommendations are not execution authorizations and do not
constitute a shipped, production-ready, Alta parity, surpass-Alta, or 100/100
claim.
"""

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any, Mapping

LOCAL_MOCK_APPROVAL_RECEIPT_VERSION = "local-mock-approval-receipt-v1-not-real-signature"
LOCAL_MOCK_APPROVAL_DECISIONS = ("APPROVED", "DENIED", "HOLD")
LOCAL_MOCK_CANONICAL_FIELD_ORDER = (
    "tenant_id",
    "lead_id",
    "reviewer_id",
    "approval_decision",
    "nonce",
    "timestamp",
)
LOCAL_MOCK_RECEIPT_FIELD_ORDER = (
    "tenant_id",
    "lead_id",
    "reviewer_id",
    "approval_decision",
    "canonical_payload_hash",
    "nonce",
    "timestamp",
    "mock_signature",
    "mock_key_id_or_version",
    "revocation_status_reference",
    "local_mock_ledger_entry_id",
    "local_mock_only",
    "not_real_signature",
    "not_real_approval_authenticity",
)
CLAIM_SAFE_SUCCESSOR_LINE = (
    "Agent readiness recommendations are not execution authorizations and do not "
    "constitute a shipped, production-ready, Alta parity, surpass-Alta, or 100/100 claim."
)


class LocalMockApprovalError(ValueError):
    """Raised only for fake/local/mock approval receipt validation failures."""


@dataclass(frozen=True)
class LocalMockApprovalPayload:
    """Canonical local-only payload; not real reviewer identity or approval authenticity."""

    tenant_id: str
    lead_id: str
    reviewer_id: str
    approval_decision: str
    nonce: str
    timestamp: str


@dataclass(frozen=True)
class LocalMockApprovalReceipt:
    """Fake/local/mock receipt; not a real signature and not production proof."""

    tenant_id: str
    lead_id: str
    reviewer_id: str
    approval_decision: str
    canonical_payload_hash: str
    nonce: str
    timestamp: str
    mock_signature: str
    mock_key_id_or_version: str
    revocation_status_reference: str
    local_mock_ledger_entry_id: str
    local_mock_only: bool = True
    not_real_signature: bool = True
    not_real_approval_authenticity: bool = True

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        return {field: data[field] for field in LOCAL_MOCK_RECEIPT_FIELD_ORDER}


def _require_nonempty_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise LocalMockApprovalError(f"{field} is required for local mock approval receipt")
    return value


def canonical_local_mock_payload(payload: Mapping[str, Any]) -> dict[str, str]:
    """Return exact-order deterministic local mock payload; not real approval authenticity."""

    missing = [field for field in LOCAL_MOCK_CANONICAL_FIELD_ORDER if field not in payload]
    if missing:
        raise LocalMockApprovalError(f"missing local mock approval payload fields: {missing}")
    canonical = {
        "tenant_id": _require_nonempty_string(payload["tenant_id"], "tenant_id"),
        "lead_id": _require_nonempty_string(payload["lead_id"], "lead_id"),
        "reviewer_id": _require_nonempty_string(payload["reviewer_id"], "reviewer_id"),
        "approval_decision": _require_nonempty_string(payload["approval_decision"], "approval_decision"),
        "nonce": _require_nonempty_string(payload["nonce"], "nonce"),
        "timestamp": _require_nonempty_string(payload["timestamp"], "timestamp"),
    }
    if canonical["approval_decision"] not in LOCAL_MOCK_APPROVAL_DECISIONS:
        raise LocalMockApprovalError("invalid local mock approval_decision")
    return canonical


def deterministic_local_mock_json(payload: Mapping[str, Any]) -> str:
    """Deterministic JSON serialization for local mock tests only; not a signature."""

    return json.dumps(canonical_local_mock_payload(payload), separators=(",", ":"), ensure_ascii=True)


def local_mock_canonical_payload_hash(payload: Mapping[str, Any]) -> str:
    """Return deterministic local mock payload hash; not production proof."""

    return hashlib.sha256(deterministic_local_mock_json(payload).encode("utf-8")).hexdigest()


class LocalMockSigner:
    """Explicitly fake/local/mock signer interface; not a real signer or key service."""

    def __init__(self, mock_key_id_or_version: str = "local-mock-key-v1-not-real") -> None:
        self.mock_key_id_or_version = _require_nonempty_string(
            mock_key_id_or_version,
            "mock_key_id_or_version",
        )

    def create_local_mock_receipt(self, payload: Mapping[str, Any]) -> LocalMockApprovalReceipt:
        canonical = canonical_local_mock_payload(payload)
        canonical_hash = local_mock_canonical_payload_hash(canonical)
        mock_signature_material = {
            "version": LOCAL_MOCK_APPROVAL_RECEIPT_VERSION,
            "canonical_payload_hash": canonical_hash,
            "mock_key_id_or_version": self.mock_key_id_or_version,
            "local_mock_only": True,
            "not_real_signature": True,
            "not_real_approval_authenticity": True,
        }
        mock_signature_hash = hashlib.sha256(
            json.dumps(mock_signature_material, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()[:24]
        mock_signature = f"mock-local-only-not-a-real-signature-{mock_signature_hash}"
        ledger_id = f"local-mock-ledger-entry-{canonical_hash[:16]}"
        return LocalMockApprovalReceipt(
            tenant_id=canonical["tenant_id"],
            lead_id=canonical["lead_id"],
            reviewer_id=canonical["reviewer_id"],
            approval_decision=canonical["approval_decision"],
            canonical_payload_hash=canonical_hash,
            nonce=canonical["nonce"],
            timestamp=canonical["timestamp"],
            mock_signature=mock_signature,
            mock_key_id_or_version=self.mock_key_id_or_version,
            revocation_status_reference="local-mock-revocation-not-implemented-phase-c-f",
            local_mock_ledger_entry_id=ledger_id,
            local_mock_only=True,
            not_real_signature=True,
            not_real_approval_authenticity=True,
        )

    def verify_local_mock_receipt(
        self,
        payload: Mapping[str, Any],
        receipt: Mapping[str, Any] | LocalMockApprovalReceipt,
    ) -> bool:
        """Validate a receipt generated by this mock interface; forged strings fail."""

        receipt_dict = receipt.to_dict() if isinstance(receipt, LocalMockApprovalReceipt) else dict(receipt)
        required_missing = [field for field in LOCAL_MOCK_RECEIPT_FIELD_ORDER if field not in receipt_dict]
        if required_missing:
            raise LocalMockApprovalError(f"missing local mock receipt fields: {required_missing}")
        if receipt_dict.get("local_mock_only") is not True:
            raise LocalMockApprovalError("local_mock_only flag is required")
        if receipt_dict.get("not_real_signature") is not True:
            raise LocalMockApprovalError("not_real_signature disclaimer is required")
        if receipt_dict.get("not_real_approval_authenticity") is not True:
            raise LocalMockApprovalError("not_real_approval_authenticity disclaimer is required")
        if not str(receipt_dict.get("mock_signature", "")).startswith(
            "mock-local-only-not-a-real-signature-"
        ):
            raise LocalMockApprovalError("mock_signature must be generated by LocalMockSigner")
        expected = self.create_local_mock_receipt(payload).to_dict()
        if receipt_dict != expected:
            raise LocalMockApprovalError("local mock receipt does not match canonical payload")
        return True


class MockApprovalSigner(LocalMockSigner):
    """Alias with load-bearing mock naming; still fake/local and not a real signer."""


def create_local_mock_approval_receipt(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Convenience wrapper returning fake/local/mock receipt dict only."""

    return LocalMockSigner().create_local_mock_receipt(payload).to_dict()


def verify_local_mock_approval_receipt(payload: Mapping[str, Any], receipt: Mapping[str, Any]) -> bool:
    """Convenience wrapper validating fake/local/mock receipt dict only."""

    return LocalMockSigner().verify_local_mock_receipt(payload, receipt)
