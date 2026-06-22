# Audience & Signal Builder (Sales Closer GTM, lane B4)

A lawful, fixture/manual-input audience + signal builder. It turns a manual,
CSV-like set of prospect rows into a ranked, PII-safe audience with a
transparent score breakdown and evidence tags.

> **No-scraping guarantee.** This module performs **no scraping of any kind**.
> There is no Google Maps scraping, no Apify, no external API, no vendor SDK,
> and no network access (no `fetch`/`axios`/`node:http`/`https`/`net`/`tls`/
> `child_process`). The only input is a manual array of rows supplied by an
> operator or a `.example` fixture. All logic is pure and deterministic.

## Capability labelling

| Capability                                                           | Status                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Deterministic signal scoring (`signalScoring.ts`)                    | **REAL**                                                                              |
| Audience validation / normalization / ranking (`audienceBuilder.ts`) | **REAL**                                                                              |
| Input data (fixtures, manual rows)                                   | **MOCK / SANDBOX**                                                                    |
| `manual`, `consented_csv`, `public_site_manual_review` sources       | **SANDBOX** (fixture-fed)                                                             |
| `licensed_provider_planned` source                                   | **PLANNED** (accepted structurally; no live provider, elevated risk, `label:PLANNED`) |
| Any external/automated sourcing                                      | **NOT BUILT — out of scope**                                                          |

## Input schema (`AudienceInputRow`)

Business attributes only. Contact fields must be safe placeholders or they are
dropped (see PII policy below).

| Field                 | Type              | Notes                                                                       |
| --------------------- | ----------------- | --------------------------------------------------------------------------- |
| `id`                  | string (required) | Stable id; used for tie-break ordering. Empty -> rejected.                  |
| `companyName`         | string            | Non-PII business name.                                                      |
| `source`              | string (required) | Must be a lawful source label (below); else rejected.                       |
| `fit`                 | number 0..1       | ICP match. Defaults to neutral `0.5`. Clamped.                              |
| `urgency`             | number 0..1       | Buying-signal urgency. Defaults to `0.5`. Clamped.                          |
| `consentBasis`        | enum              | `explicit_consent` \| `legitimate_interest` \| `not_established` (default). |
| `evidence`            | enum              | `verified_fact` \| `likely_inference` \| `unknown` (default).               |
| `region`              | string            | Optional non-PII region.                                                    |
| `contactEmailExample` | string            | Kept ONLY if it ends in `.example`; else dropped.                           |
| `contactPhoneExample` | string            | Kept ONLY if it is a `555-01xx` test number; else dropped.                  |
| `notes`               | string            | Optional free-form non-PII notes.                                           |

## Lawful-source policy

Only these source labels are accepted. **Any other value is rejected** with a
clear `disallowed_source` reason (the rejected row is never scored):

| Label                       | Meaning                                                     | Source risk |
| --------------------------- | ----------------------------------------------------------- | ----------- |
| `manual`                    | Keyed in by an operator from a lawful basis.                | low         |
| `consented_csv`             | A CSV the data subjects consented to share.                 | low         |
| `public_site_manual_review` | A public business page reviewed by a human (no bot scrape). | medium      |
| `licensed_provider_planned` | A licensed data provider — **PLANNED**, not yet integrated. | high        |

Disallowed examples that are blocked: `maps_platform_scrape`, `apify`,
`google_maps`, `search_engine`, empty string — and anything not on the list.

## Scoring model (`signalScoring.ts`)

A fixed, documented linear blend of five components -> a single `0..1` score
with a signed per-component breakdown. Pure and deterministic.

```
score = clamp01(
    0.40 * fit
  + 0.25 * urgency
  + 0.15 * proofConfidence
  - 0.20 * consentRisk
  - 0.20 * sourceRisk
)
```

- **fit** (0..1) — ICP match. Higher raises the score.
- **urgency** (0..1) — buying-signal timing/intent. Higher raises the score.
- **proofConfidence** — from the evidence tag: `verified_fact`=1,
  `likely_inference`=0.5, `unknown`=0. Higher raises the score.
- **consentRisk** — from `consentBasis`: low=0, medium=0.5, high=1. Applied as a
  **penalty** (subtracted).
- **sourceRisk** — from the source label band (low=0, medium=0.5, high=1).
  Applied as a **penalty** (subtracted).

The breakdown returns each contribution signed (penalties negative) plus the
normalized component values, so a reviewer can always reconstruct the score.
Ranking is by score descending, with `id` ascending as a deterministic
tie-break.

## PII / data-handling policy

- Output is **PII-safe by construction**. No raw email or phone is ever stored
  or emitted.
- Email is retained only if it matches `*@*.example`; phone only if it matches a
  `555-01xx` North American test number. Anything else is dropped and the
  prospect is tagged `dropped_unsafe_email` / `dropped_unsafe_phone`.
- Budget Wheels appears only as `budget_wheels_demo` / Tenant Zero fixture data.
- No tokens, chains, payments, crypto, or production/result claims.

## Evidence tags

Each ranked prospect carries `evidenceTags` for review surfaces, e.g.
`source:<label>`, `consent:<basis>`, `evidence:<tag>`, plus `label:SANDBOX` (or
`label:PLANNED` for the licensed-provider source), and any `dropped_unsafe_*`
markers.

## Exports

- `signalScoring.ts`: `scoreSignals`, `SignalInputs`, `SignalScore`,
  `ScoreBreakdown`, `RiskBand`, `EvidenceTag`, `SIGNAL_WEIGHTS`,
  `RISK_BAND_VALUE`, `EVIDENCE_CONFIDENCE`.
- `audienceBuilder.ts`: `buildAudience`, `AudienceInputRow`, `RankedProspect`,
  `RejectedRow`, `AudienceResult`, `LAWFUL_SOURCE_LABELS`, `LawfulSourceLabel`,
  `ConsentBasis`.
