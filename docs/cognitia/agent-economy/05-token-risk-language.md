# Memo 5 — Token-Risk Language

**Status:** sandbox policy · internal only
**Boundaries:** this memo *defines* the boundary. It is the one place where banned
terms appear — and only as a deny-list, never as a claim.

## 1. Purpose

Give everyone writing about the agent economy a fixed vocabulary: what we **may**
say, what we **must not** say, and a reusable disclaimer block. The goal is that no
internal document, demo, or comment can be read as offering a token, an
investment, or a financial return.

## 2. Approved internal vocabulary

| Use this | Instead of |
|----------|-----------|
| internal credit / non-redeemable accounting unit | coin, token, currency |
| internal ledger entry | transaction (in the money sense) |
| escrow hold / release | payment, settlement (financial) |
| reputation / standing | rank, score with monetary tie |
| proof event / verified_fact | guarantee, certification, attestation of legal fact |
| sandbox / simulation | launch, mainnet, production economy |
| agent passport | wallet, account (financial) |

## 3. Banned-language list (deny-list)

These terms **must not** appear as claims, promises, or descriptions of the credit
anywhere in agent-economy docs, code, comments, demos, or commit messages. They
are listed here **only** so they can be mechanically grepped for and rejected:

- `investment`, `invest`, `investor`
- `appreciation`, `appreciate` (in the value sense), `price`, `valuation`
- `yield`, `staking rewards`, `dividend`, `return on`
- `liquidity`, `liquidity pool`, `market maker`
- `listing`, `exchange listing`, `IEO`, `ICO`, `IDO`
- `presale`, `airdrop`, `allocation`, `vesting` (as public distribution)
- `tradable`, `redeemable for cash`, `convertible to`
- `to the moon`, `guaranteed returns`, `passive income`

> A reviewer or lint guard may grep for these terms. A hit is acceptable **only**
> inside: this banned-language list, a guardrail definition, a disclaimer block, or
> a "do-not-build-yet" section (Memo 6). Anywhere else, it is a defect.

## 4. `TOKEN_GATES` summary (all currently NOT PASSED)

Any move toward a public token is gated behind eight **conjunctive** gates
(sibling-branch doctrine; *not verified in this branch HEAD*). All are currently
**NOT PASSED**, and nothing in this work changes that.

| # | Gate (paraphrased) | Status |
|---|--------------------|--------|
| 1 | Real, recurring tenant revenue exists | NOT PASSED |
| 2 | Verified-proof volume is meaningful and audited | NOT PASSED |
| 3 | Internal credit accounting is reconciled and stable | NOT PASSED |
| 4 | Legal/regulatory review completed by qualified counsel | NOT PASSED |
| 5 | Compliance (KYC/AML) framework in place | NOT PASSED |
| 6 | Governance + treasury controls defined | NOT PASSED |
| 7 | Security/audit of any settlement mechanism | NOT PASSED |
| 8 | Explicit, documented executive go decision | NOT PASSED |

Gates are illustrative of the *shape* of the requirement, not legal advice, and
the exact gate text lives in the doctrine source. **All eight must pass; today
none do.**

## 5. Reusable disclaimer block

Paste verbatim into any agent-economy document:

```text
SANDBOX / SIMULATION ONLY. "Credits" are non-redeemable internal accounting
units used to model agent work. They are not money, securities, or a token,
carry no monetary value, and confer no investment, ownership, or financial
return of any kind. Nothing here is an offer, solicitation, financial advice,
or a legal conclusion. No public token, liquidity, listing, or blockchain
deployment exists or is promised. Token gates remain NOT PASSED.
```

## 6. Verification

Boundary scan (a hit outside §3/§4/§5 of this memo, a guardrail, or Memo 6 is a
defect):

```bash
grep -rniE 'invest|appreciation|liquidity|listing|presale|airdrop|yield' \
  docs/cognitia/agent-economy/ sandbox/agent_economy/
```
The guardrail itself is enforced in code by
`assert_no_public_token_surface()` and `GuardrailTests`.
