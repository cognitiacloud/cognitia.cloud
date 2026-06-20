# Cognitia 36-Hour Agentic Loop — Guardrails & Classification

**Window:** Start 2026-06-20. Run 36h unless stopped earlier.
**Manager:** 36-Hour Cognitia Agentic Loop Manager.

This file is the control plane. Every worker and checkpoint MUST obey it.

---

## Hard-stop boundaries (NEVER do these in this loop)

1. No public token launch.
2. No real-money liquidity.
3. No investor / token appreciation promises.
4. No real outreach to leads.
5. No paid ad launch.
6. No WhatsApp / SMS / email sending.
7. No vendor adapter implementation unless explicitly marked **SANDBOX/MOCK**.
8. No raw PII in artifacts, logs, fixtures, or reports.
9. No guaranteed ROI, sales, SEO rankings, financing approval, or lead volume.

If a task appears to require any of the above, STOP and route it to the
"Decisions needed from founder" section of the active checkpoint.

## Allowed

- Deep research, competitor mapping, artifact generation, specs, prompts,
  test plans, mock workflows, internal-only token/credit sandbox design,
  file-based goal-harness prototype spec.
- Optional code ONLY for an isolated harness MVP. No production integration.

## PII policy

- Use synthetic, clearly-fake data only. Names like "Jordan Sample",
  phones like `+1-555-0100`, emails like `lead+demo@example.invalid`.
- VINs, plates, financials in fixtures must be obviously fake and labeled.
- Never paste real customer, lead, or dealership records.

---

## Output classification legend

Every worker finding/artifact line is tagged with exactly one:

- **VERIFIED** — Confirmed against a primary source, the codebase, or a tool
  result captured in this loop. Cite the source.
- **INFERRED** — Reasoned conclusion from partial evidence. State the basis.
- **RECOMMENDED** — A judgment call / proposal for the founder to act on.
- **UNSAFE / DO NOT DO YET** — Touches a hard-stop boundary or needs explicit
  founder sign-off, legal review, or real credentials before it can proceed.

---

## System glossary

- **Cognitia** — agent economy, proof registry, compliance/control plane,
  CRM-lite, Sales Closer, action ledger, agent trust infrastructure.
- **Demandara** — GTM / growth operator: client acquisition, media, ads,
  fulfillment.
- **Client Zero** — car dealership / Auto Growth OS proof client.

## Workers

| ID | Worker | Owns directory |
|----|--------|----------------|
| A | GTM / Competitor Research | `cognitia/workers/A-gtm-competitor-research/` |
| B | Client Zero Auto Growth OS | `cognitia/workers/B-client-zero-auto-growth-os/` |
| C | Ads + Media House | `cognitia/workers/C-ads-media-house/` |
| D | Agent Economy + Token Sandbox | `cognitia/workers/D-agent-economy-token-sandbox/` |
| E | Harness Builder | `cognitia/workers/E-harness-builder/` |

## Checkpoint cadence

Every 6h produce `cognitia/loop/checkpoints/checkpoint-NN-hourHH.md` with:
artifacts created, strongest findings, roadmap changes, kill/park list,
security/compliance risks, next 6h plan, decisions needed, exact file paths.
