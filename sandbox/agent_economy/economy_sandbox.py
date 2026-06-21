"""Cognitia Agent Economy — internal sandbox engine.

SANDBOX ONLY. This module is a self-contained, in-memory simulation of
Cognitia's internal agent economy. It exists to demonstrate the design and to
let the invariants be tested. It is NOT production code.

Hard boundaries enforced here:
  * No public coin, no liquidity, no exchange listing.
  * "Credits" are non-redeemable internal accounting units, NOT a token,
    NOT money, and carry no investment value of any kind.
  * No network calls, no database writes, no blockchain client. Standard
    library only.

Vocabulary (proofs, reputation_events, credits_ledger, work_orders,
audit_events, agent_trust_credentials) is aligned to sibling-branch design and
is NOT verified in this branch HEAD. It is mirrored here in memory so the loop
can run offline.
"""

from __future__ import annotations

import enum
import itertools
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


# ---------------------------------------------------------------------------
# Guardrails — the hard boundary expressed as executable assertions.
# ---------------------------------------------------------------------------

GUARDRAILS = {
    "public_token": False,        # no public coin launch
    "liquidity_pool": False,      # no liquidity
    "exchange_listing": False,    # no exchange listing
    "external_redeemable": False, # credits are not redeemable for money/value
    "external_transfer": False,   # credits never leave the internal rail
    "chain_deployment": False,    # no real blockchain (no testnet here either)
}

# Rail every account must sit on. Anything else is a boundary violation.
INTERNAL_RAIL = "internal"


class GuardrailViolation(AssertionError):
    """Raised when a simulated action would create a public-token surface."""


def assert_no_public_token_surface(flags: Optional[dict] = None) -> None:
    """Fail loudly if any public-token / external-value surface is enabled.

    Pass an override dict to simulate a misconfiguration in tests. Any truthy
    boundary flag trips the guardrail.
    """
    effective = dict(GUARDRAILS)
    if flags:
        effective.update(flags)
    tripped = [name for name, on in effective.items() if on]
    if tripped:
        raise GuardrailViolation(
            "public-token / external-value surface is forbidden in the sandbox: "
            + ", ".join(sorted(tripped))
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Proof Registry (mirrors `proofs`) — append-only, evidence-tagged.
# ---------------------------------------------------------------------------

class EvidenceTag(str, enum.Enum):
    VERIFIED_FACT = "verified_fact"
    LIKELY_INFERENCE = "likely_inference"
    UNKNOWN = "unknown"


_proof_seq = itertools.count(1)


@dataclass(frozen=True)
class ProofEvent:
    """A single, immutable proof-registry event.

    Frozen on purpose: proofs are append-only. A correction is a NEW event that
    supersedes a prior one via `supersedes`, never an edit.
    """

    proof_id: str
    subject_ref: str            # what the proof is about (e.g. work_order:WO-1)
    claim: str                  # human-readable claim being attested
    evidence_tag: EvidenceTag   # verified_fact | likely_inference | unknown
    evidence_ref: str           # where the evidence lives (internal ref/uri)
    verifier_ref: Optional[str] # who/what verified (None until verified)
    occurred_at: str
    supersedes: Optional[str] = None

    @property
    def is_verified_fact(self) -> bool:
        return self.evidence_tag is EvidenceTag.VERIFIED_FACT


class ProofRegistry:
    """Append-only store of ProofEvents. No mutation, only append/supersede."""

    def __init__(self) -> None:
        self._events: list[ProofEvent] = []

    def record(
        self,
        subject_ref: str,
        claim: str,
        evidence_tag: EvidenceTag,
        evidence_ref: str,
        verifier_ref: Optional[str] = None,
        supersedes: Optional[str] = None,
    ) -> ProofEvent:
        evt = ProofEvent(
            proof_id=f"PRF-{next(_proof_seq)}",
            subject_ref=subject_ref,
            claim=claim,
            evidence_tag=evidence_tag,
            evidence_ref=evidence_ref,
            verifier_ref=verifier_ref,
            occurred_at=_now(),
            supersedes=supersedes,
        )
        self._events.append(evt)
        return evt

    def all(self) -> list[ProofEvent]:
        return list(self._events)

    def get(self, proof_id: str) -> Optional[ProofEvent]:
        return next((e for e in self._events if e.proof_id == proof_id), None)


# ---------------------------------------------------------------------------
# Action Ledger (mirrors `audit_events`) — append-only, idempotent.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ActionEvent:
    seq: int
    event_type: str             # versioned, e.g. economy.work_order.verified.v1
    actor_ref: str
    subject_ref: str
    detail: dict
    idempotency_key: str
    occurred_at: str


class ActionLedger:
    """Append-only agent action ledger with idempotency-key dedupe."""

    def __init__(self) -> None:
        self._events: list[ActionEvent] = []
        self._seq = itertools.count(1)
        self._seen: dict[str, ActionEvent] = {}

    def append(
        self,
        event_type: str,
        actor_ref: str,
        subject_ref: str,
        idempotency_key: str,
        detail: Optional[dict] = None,
    ) -> ActionEvent:
        if idempotency_key in self._seen:
            # Idempotent: return the original, do not append a duplicate.
            return self._seen[idempotency_key]
        evt = ActionEvent(
            seq=next(self._seq),
            event_type=event_type,
            actor_ref=actor_ref,
            subject_ref=subject_ref,
            detail=dict(detail or {}),
            idempotency_key=idempotency_key,
            occurred_at=_now(),
        )
        self._events.append(evt)
        self._seen[idempotency_key] = evt
        return evt

    def all(self) -> list[ActionEvent]:
        return list(self._events)


# ---------------------------------------------------------------------------
# Credit Ledger (mirrors `credits_ledger`) — double-entry, internal-rail-locked.
# ---------------------------------------------------------------------------

@dataclass
class Account:
    owner_ref: str
    owner_type: str             # tenant | agent | system | escrow
    rail: str = INTERNAL_RAIL
    balance: int = 0            # integer internal credits; never money


@dataclass(frozen=True)
class LedgerEntry:
    """One double-entry posting: two legs that sum to zero."""

    entry_id: int
    debit_owner: str
    credit_owner: str
    amount: int
    idempotency_key: str
    memo: str
    occurred_at: str


class LedgerError(Exception):
    pass


class CreditLedger:
    """In-memory double-entry ledger for non-redeemable internal credits."""

    def __init__(self) -> None:
        self._accounts: dict[str, Account] = {}
        self._entries: list[LedgerEntry] = []
        self._seq = itertools.count(1)
        self._seen: dict[str, LedgerEntry] = {}

    def open_account(self, owner_ref: str, owner_type: str) -> Account:
        if owner_ref in self._accounts:
            return self._accounts[owner_ref]
        acct = Account(owner_ref=owner_ref, owner_type=owner_type)
        # Internal rail lock: accounts only exist on the internal rail.
        assert acct.rail == INTERNAL_RAIL, "internal rail lock violated"
        self._accounts[owner_ref] = acct
        return acct

    def balance(self, owner_ref: str) -> int:
        return self._accounts[owner_ref].balance

    def _check_internal(self, *owners: str) -> None:
        for owner in owners:
            acct = self._accounts.get(owner)
            if acct is None:
                raise LedgerError(f"no account: {owner}")
            if acct.rail != INTERNAL_RAIL:
                raise GuardrailViolation(
                    f"account {owner} is off the internal rail ({acct.rail})"
                )

    def post(
        self,
        debit_owner: str,
        credit_owner: str,
        amount: int,
        idempotency_key: str,
        memo: str = "",
    ) -> LedgerEntry:
        """Move `amount` credits from debit_owner to credit_owner.

        Double-entry: the debit leg decreases one balance and the credit leg
        increases the other by the same amount, so the system stays balanced.
        """
        if amount <= 0:
            raise LedgerError("amount must be positive")
        if idempotency_key in self._seen:
            return self._seen[idempotency_key]

        # No external-value surface may be created by a posting.
        assert_no_public_token_surface()
        self._check_internal(debit_owner, credit_owner)

        src = self._accounts[debit_owner]
        if src.balance < amount and src.owner_type != "system":
            raise LedgerError(f"insufficient credits: {debit_owner}")

        src.balance -= amount
        self._accounts[credit_owner].balance += amount

        entry = LedgerEntry(
            entry_id=next(self._seq),
            debit_owner=debit_owner,
            credit_owner=credit_owner,
            amount=amount,
            idempotency_key=idempotency_key,
            memo=memo,
            occurred_at=_now(),
        )
        self._entries.append(entry)
        self._seen[idempotency_key] = entry
        return entry

    def entries(self) -> list[LedgerEntry]:
        return list(self._entries)

    def is_balanced(self) -> bool:
        """Total non-system credits are conserved across all postings."""
        total = sum(
            a.balance for a in self._accounts.values() if a.owner_type != "system"
        )
        minted = sum(
            e.amount
            for e in self._entries
            if self._accounts[e.debit_owner].owner_type == "system"
        )
        return total == minted


# ---------------------------------------------------------------------------
# Reputation (mirrors `reputation_events`) — positive delta only on verified_fact.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ReputationEvent:
    agent_ref: str
    delta: int
    proof_id: str
    reason: str
    occurred_at: str


class Reputation:
    """Append-only reputation with the core invariant enforced in code:

    A POSITIVE delta is only applied when backed by a `verified_fact` proof.
    Non-verified proofs can never increase reputation.
    """

    def __init__(self, registry: ProofRegistry) -> None:
        self._registry = registry
        self._events: list[ReputationEvent] = []
        self._scores: dict[str, int] = {}

    def apply(self, agent_ref: str, delta: int, proof_id: str, reason: str) -> bool:
        proof = self._registry.get(proof_id)
        if proof is None:
            raise LedgerError(f"unknown proof: {proof_id}")
        if delta > 0 and not proof.is_verified_fact:
            # Invariant: no reputation gain without a verified_fact proof.
            return False
        self._scores[agent_ref] = self._scores.get(agent_ref, 0) + delta
        self._events.append(
            ReputationEvent(agent_ref, delta, proof_id, reason, _now())
        )
        return True

    def score(self, agent_ref: str) -> int:
        return self._scores.get(agent_ref, 0)

    def events(self) -> list[ReputationEvent]:
        return list(self._events)


# ---------------------------------------------------------------------------
# Agent Passport (mirrors `agent_trust_credentials`) — internal identity only.
# ---------------------------------------------------------------------------

@dataclass
class AgentPassport:
    """Minimal internal agent identity. W3C-VC-*like* shape, internal refs only.

    No cryptographic suites, no DIDs resolvable on a public network, no PII.
    """

    agent_ref: str
    display_name: str
    capabilities: tuple[str, ...]
    atc_ref: str                # internal Agent Trust Credential reference
    issued_at: str = field(default_factory=_now)


# ---------------------------------------------------------------------------
# Work Order + escrow — releases ONLY against a verified_fact proof.
# ---------------------------------------------------------------------------

class WorkOrderState(str, enum.Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DELIVERED = "delivered"
    VERIFIED = "verified"
    REJECTED = "rejected"
    CANCELED = "canceled"


class WorkOrderError(Exception):
    pass


@dataclass
class WorkOrder:
    order_id: str
    payer_ref: str              # who funds the work (e.g. tenant)
    worker_ref: str             # agent doing the work
    amount: int                 # credits held in escrow
    state: WorkOrderState = WorkOrderState.PROPOSED
    delivery_proof_id: Optional[str] = None


class EconomyEngine:
    """Ties the pieces together into the agent-economy loop."""

    ESCROW = "system:escrow"
    SYSTEM = "system:mint"

    def __init__(self) -> None:
        assert_no_public_token_surface()
        self.ledger = CreditLedger()
        self.proofs = ProofRegistry()
        self.actions = ActionLedger()
        self.reputation = Reputation(self.proofs)
        self.passports: dict[str, AgentPassport] = {}
        self._orders: dict[str, WorkOrder] = {}
        self._order_seq = itertools.count(1)
        self.ledger.open_account(self.SYSTEM, "system")
        self.ledger.open_account(self.ESCROW, "escrow")

    # --- setup -----------------------------------------------------------
    def register_agent(self, passport: AgentPassport) -> None:
        self.passports[passport.agent_ref] = passport
        self.ledger.open_account(passport.agent_ref, "agent")
        self.actions.append(
            "economy.agent.registered.v1",
            actor_ref="system",
            subject_ref=passport.agent_ref,
            idempotency_key=f"register:{passport.agent_ref}",
            detail={"capabilities": list(passport.capabilities)},
        )

    def fund_tenant(self, tenant_ref: str, amount: int) -> None:
        self.ledger.open_account(tenant_ref, "tenant")
        self.ledger.post(
            self.SYSTEM, tenant_ref, amount,
            idempotency_key=f"grant:{tenant_ref}",
            memo="initial internal credit grant (non-redeemable)",
        )

    # --- work order loop -------------------------------------------------
    def propose(self, payer_ref: str, worker_ref: str, amount: int) -> WorkOrder:
        order = WorkOrder(
            order_id=f"WO-{next(self._order_seq)}",
            payer_ref=payer_ref,
            worker_ref=worker_ref,
            amount=amount,
        )
        self._orders[order.order_id] = order
        self.actions.append(
            "economy.work_order.proposed.v1", payer_ref, order.order_id,
            idempotency_key=f"propose:{order.order_id}",
            detail={"worker": worker_ref, "amount": amount},
        )
        return order

    def accept(self, order_id: str) -> WorkOrder:
        order = self._require(order_id, WorkOrderState.PROPOSED)
        # Fund escrow from the payer.
        self.ledger.post(
            order.payer_ref, self.ESCROW, order.amount,
            idempotency_key=f"escrow-fund:{order_id}",
            memo=f"escrow hold for {order_id}",
        )
        order.state = WorkOrderState.ACCEPTED
        self.actions.append(
            "economy.work_order.accepted.v1", order.worker_ref, order_id,
            idempotency_key=f"accept:{order_id}",
        )
        return order

    def deliver(self, order_id: str, evidence_ref: str) -> ProofEvent:
        order = self._require(order_id, WorkOrderState.ACCEPTED)
        # Delivery is initially an unverified claim.
        proof = self.proofs.record(
            subject_ref=f"work_order:{order_id}",
            claim="worker delivered the requested outcome",
            evidence_tag=EvidenceTag.LIKELY_INFERENCE,
            evidence_ref=evidence_ref,
        )
        order.state = WorkOrderState.DELIVERED
        order.delivery_proof_id = proof.proof_id
        self.actions.append(
            "economy.work_order.delivered.v1", order.worker_ref, order_id,
            idempotency_key=f"deliver:{order_id}",
            detail={"proof_id": proof.proof_id},
        )
        return proof

    def verify(self, order_id: str, verifier_ref: str, ok: bool) -> WorkOrder:
        """Verifier attests the delivery. On success a verified_fact proof is
        recorded (superseding the delivery claim), escrow is released to the
        worker, and reputation increases. On failure escrow is refunded and no
        reputation is granted."""
        order = self._require(order_id, WorkOrderState.DELIVERED)
        if ok:
            verified = self.proofs.record(
                subject_ref=f"work_order:{order_id}",
                claim="delivered outcome verified against acceptance criteria",
                evidence_tag=EvidenceTag.VERIFIED_FACT,
                evidence_ref=f"verifier:{verifier_ref}",
                verifier_ref=verifier_ref,
                supersedes=order.delivery_proof_id,
            )
            # Escrow releases ONLY against a verified_fact proof.
            assert verified.is_verified_fact, "escrow release requires verified_fact"
            self.ledger.post(
                self.ESCROW, order.worker_ref, order.amount,
                idempotency_key=f"escrow-release:{order_id}",
                memo=f"escrow release for {order_id}",
            )
            order.state = WorkOrderState.VERIFIED
            self.reputation.apply(
                order.worker_ref, +1, verified.proof_id,
                reason=f"verified delivery of {order_id}",
            )
            self.actions.append(
                "economy.work_order.verified.v1", verifier_ref, order_id,
                idempotency_key=f"verify:{order_id}",
                detail={"proof_id": verified.proof_id},
            )
        else:
            self.ledger.post(
                self.ESCROW, order.payer_ref, order.amount,
                idempotency_key=f"escrow-refund:{order_id}",
                memo=f"escrow refund for {order_id}",
            )
            order.state = WorkOrderState.REJECTED
            self.actions.append(
                "economy.work_order.rejected.v1", verifier_ref, order_id,
                idempotency_key=f"reject:{order_id}",
            )
        return order

    def order(self, order_id: str) -> WorkOrder:
        return self._orders[order_id]

    def _require(self, order_id: str, state: WorkOrderState) -> WorkOrder:
        order = self._orders.get(order_id)
        if order is None:
            raise WorkOrderError(f"unknown order: {order_id}")
        if order.state is not state:
            raise WorkOrderError(
                f"{order_id} is {order.state.value}, expected {state.value}"
            )
        return order
