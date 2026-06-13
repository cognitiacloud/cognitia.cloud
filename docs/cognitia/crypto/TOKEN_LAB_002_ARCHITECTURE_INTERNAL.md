# TOKEN LAB 002 — Internal Token Architecture Spec (INTERNAL; legal-gated; never public)

Date: 2026-06-12. Classification: INTERNAL. Successor to
`TOKEN_LAB_001_INTERNAL.md`; companion to `TOKEN_UTILITY_MAP.md`,
`TOKEN_GATES.md`, and `../agent-economy/CROSS_TENANT_SETTLEMENT_DESIGN.md`.

**Standing facts (unchanged by this document):** there is no token — not
launched, not minted, not on a testnet. There is no liquidity, no DEX plan,
no staking or yield product, no exchange-listing intent, no public token or
coin page (doctrine guards fail the build otherwise). All eight TOKEN_GATES
are conjunctive and **NOT PASSED**. This spec exists so that IF the gates
ever pass, the architecture is already honest, evidence-backed, and boring.
Everything below is design (`likely_inference`); statements about the built
lab are `verified_fact`.

---

## 1. Utility model — what the token would actually DO

Rule inherited from TOKEN_UTILITY_MAP: a utility belongs here only if its
credits version already runs in the lab AND credits are demonstrably
insufficient for it (the utility gate, #6). The candidates organize into
three layers:

### 1a. Settlement (probably NOT the token — see §3)

Pricing and paying for agent work. Credits do this today (0012–0018);
cleared cross-tenant balances (005 design) extend it. External settlement of
cleared balances is a better fit for a **stablecoin**, not a volatile
utility token — denominating work in a fluctuating unit would damage the
economy it serves. The token is deliberately NOT pitched as "the money".

### 1b. Assurance collateral (the core token thesis)

The lab's trust machinery creates real demand for **skin in the game**:

| Bond           | Backs                                     | Slash trigger (see §2)                     |
| -------------- | ----------------------------------------- | ------------------------------------------ |
| Verifier bond  | a verifier's `verified_fact` attestations | attestation superseded as false            |
| Publisher bond | a SkillProof version's fitness            | yank for defect                            |
| Worker bond    | work-order delivery quality               | dispute resolved against worker            |
| Dispute bond   | the challenge itself (anti-spam)          | frivolous dispute ruled against challenger |

Collateral must be at risk to mean anything — that is what credits cannot
honestly provide (platform-issued credits slashed by the platform is
circular assurance). THIS is the strongest "credits are insufficient"
argument and the most defensible utility.

### 1c. Coordination (narrow, last)

Contributor rewards (settled like any work order) and **narrow parameter
governance** at most (e.g. bond minimums, arbitration windows). Safety
gates, doctrine, and anything customer-affecting stay off-chain and
founder/owner-governed. No treasury votes, no protocol-politics theater.

Hard exclusions restated: reputation scores and proofs are evidence, never
assets; no yield/appreciation mechanics; nothing scoped to one tenant (A1).

## 2. Bonding / slashing design (credits-first, token-later)

Designed to run on INTERNAL CREDITS first — the same path every economy
mechanic has taken (build → measure → only then consider mapping):

- **A bond is an escrow-shaped credits account** (`owner_type='bond'`, a
  future deliberate 0012-style widening) funded by the bonded party,
  registered against a subject ref (`verifier:…`, `skill_version:…`,
  `agent:…`). Posting, topping up, and releasing are balanced, idempotent,
  audited ledger pairs — nothing new.
- **A slash is an arbitrated, conserved transfer**, never a burn-by-default
  and never automatic: a slashing case follows the 0017 dispute pattern —
  evidence in, platform-arbiter decision, append-only resolution record,
  `verified_fact` resolution proof, conserved split between the harmed
  party and a platform remediation account. Appeal window before funds move.
- **Slash conditions are enumerated and evidence-gated** (table in §1b);
  each requires a proof chain (e.g. a superseding proof demonstrating the
  original attestation false), not an accusation.
- **Bonds earn NOTHING.** No interest, no rewards, no yield — a bond is
  collateral, not an investment. This is a design rule AND a communications
  rule (§6): the word for this mechanic is _bonding_, used only in internal
  docs; nothing here may ever be marketed as staking returns.
- Token mapping (Stage 3, gated): identical semantics, with the arbitrated
  slash executed by a contract function callable only by the platform
  arbiter role, after the same off-chain evidence process. The chain adds
  external verifiability of OUTCOMES; it never replaces the evidence
  process.

## 3. The split: credits vs stablecoin vs token

Each layer does only what the layer below provably cannot:

| Layer                | Job                                                                                                        | Why this layer                                                                                                            | Status                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Internal credits** | unit of account; work pricing; escrow; clearing (005)                                                      | stable, free, instant, fully audited, RLS-scoped; the evidence system already gates it                                    | built / designed                                    |
| **Stablecoin**       | external settlement of CLEARED platform balances only (never per-work-order escrow, never customer-facing) | external value needs a stable unit; volatility must not touch work pricing                                                | Stage 2; legal-gated; not designed beyond placement |
| **Token**            | assurance collateral (§1b); narrow coordination (§1c); cross-platform interop of agent trust               | collateral must be at risk and externally verifiable to assure outsiders; platform-issued credits cannot do that honestly | Stage 3; ALL gates                                  |

Anti-pattern explicitly rejected: one token doing all three jobs. That
design forces the conflicts (volatile work pricing, yield pressure,
governance capture) this split exists to avoid.

## 4. Base/EVM sandbox plan (phased, each phase separately gated)

| Phase                | Where                                                                                    | What                                                                                                                                                                                                                                                         | Gate to enter                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **S0**               | local-only chain (e.g. anvil), developer machine, nothing committed beyond the §7 sketch | prove the escrow/bond semantics compile and the conserved-math invariants hold in contract form; throwaway                                                                                                                                                   | founder go on a TOKEN-LAB-003 ticket                                                            |
| **S1**               | Base Sepolia TESTNET, test tokens only, zero value                                       | wallet-binding placeholders (0012/0014) become a real binding registry for TEST addresses; EAS attestation anchoring of `public_safe` proofs trialed (`external_attestation_ref` column already reserved); ERC-8004-style agent identity compat per the Lock | founder + counsel sign-off that testnet activity is permissible; comms gate (no public framing) |
| **S2**               | audited contracts, still no mainnet value                                                | external audit (gate #7) of the S1 contracts + platform trust surfaces                                                                                                                                                                                       | gates 1–3 (product/usage/multi-tenant) passed with evidence                                     |
| **mainnet anything** | —                                                                                        | —                                                                                                                                                                                                                                                            | ALL EIGHT gates; founder; counsel; not before                                                   |

Repo rule until S0 is ticketed: **no Solidity toolchain, no contracts
directory, no deploy scripts in this repository.** The sketch lives in §7 of
this internal doc only.

## 5. Legal gates — operational checklist for engaging counsel

TOKEN_GATES #4/#5 stay the gate; this is the work packet for when the
founder engages counsel:

1. Classification analysis (Canada first — founder jurisdiction — then US):
   utility-vs-security treatment of (a) an assurance-collateral token with
   zero yield, (b) testnet-only activity, (c) internal credits as they exist.
2. Whether the bonding/slashing mechanic (no yield, arbitrated forfeiture)
   changes classification.
3. Stablecoin settlement of inter-tenant balances: money-transmission /
   MSB / FINTRAC exposure.
4. KYC/AML posture required at each stage of §4.
5. Communications constraints counsel wants enforced (input to §6 and to
   extending the doctrine guards).
   Deliverable: written opinion + founder sign-off, archived in this directory.

## 6. Communications guardrails

- **Enforced today by doctrine-guard tests** (build-failing): no
  token/coin/staking/presale/airdrop route or page in the web app; no
  token-marketing phrases; crypto/token language confined to
  `docs/cognitia/` internal docs.
- The only approved external statement remains the crypto-readiness
  statement (verbatim in the API/console): designed-for-later, internal
  credits only, everything else legal-gated.
- Banned in ANY public material, forever-until-counsel-says-otherwise:
  price or return language, "get in early"/presale/airdrop/launch framing,
  exchange-listing language, yield/APY framing of bonds, supply/tokenomics
  numbers, dates.
- Internal vocabulary discipline: _bonding_ (not staking), _assurance
  collateral_ (not investment), _arbitrated slash_ (not penalty yield),
  public names per the Lock (Agent Trust Credential / ATC — never the
  legacy passport name; no custom DID method).
- Any future public sentence about tokens requires: counsel review +
  founder approval + a doctrine-guard extension covering the new surface
  BEFORE publication (communications gate #8).

## 7. Appendix — contract SKETCH (non-deployable, illustration only)

NOT code: no toolchain in this repo, never compiled here, deployment
forbidden until §4 gates. Shape-checking the §2 semantics only — note that
every privileged function is the platform arbiter, every movement is
conserved, and there is no mint/burn/yield surface at all:

```text
interface IWorkOrderClearing {            // Stage-2+ mirror of 005 §4
  reserve(bytes32 xwoId, uint256 amount)                 // requester clearing → escrow
  release(bytes32 xwoId, bytes32 proofProjectionHash)    // arbiter-only; requires verified_fact projection hash
  refund(bytes32 xwoId)                                  // arbiter-only
  split(bytes32 xwoId, uint256 toWorker, uint256 toRequester)
                                                         // arbiter-only; toWorker + toRequester == reserved (conserved)
}

interface IAssuranceBond {                // §2 semantics
  post(bytes32 subjectRef, uint256 amount)               // bonded party funds collateral
  topUp(bytes32 subjectRef, uint256 amount)
  requestRelease(bytes32 subjectRef)                     // starts notice window; no instant exit while cases open
  slash(bytes32 subjectRef, uint256 amount,
        bytes32 resolutionProofRef,                      // off-chain 0017-style resolution, verified_fact
        address harmedParty)                             // arbiter-only; conserved transfer, never a burn-by-default
}
// Deliberately absent: mint, burn, reward, claim, stake, swap, pause-less
// admin powers. Identity/attestation via existing standards (EAS refs,
// ERC-8004-style agent ids) — no custom method.
```

## 8. What would make this spec wrong (falsifiers, recorded honestly)

- If Stage-1 clearing volume never materializes, the token has no substrate
  — stop at credits (cheapest correct outcome).
- If counsel finds the assurance-collateral model classified as a security
  in target jurisdictions regardless of yield-absence, §1b dies and with it
  most of the thesis — record and stop.
- If credits-based bonds prove sufficient assurance for actual internal
  participants (the circularity concern turns out not to bind), the utility
  gate (#6) never passes — correct outcome is also stop.
