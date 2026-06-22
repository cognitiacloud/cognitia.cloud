# Client Zero Pilot Checklist

> **Template, not a live pilot.** "Client Zero" is the **first/zeroth** pilot
> engagement — there is no running pilot and no prior customers. Scoped to the
> **current Hermes Vision checkout** (`hermes/skills/vision-skill/`). Read
> [`../trust/prohibited.md`](../trust/prohibited.md) and
> [`../trust/claim-provenance.md`](../trust/claim-provenance.md) first.

## Pre-pilot

- [ ] Confirm scope: pilot validates the **Hermes Vision** control surface only,
      not the (planned) proof-governed GTM engine.
- [ ] State explicitly to the prospect: not SOC2 certified; early
      SOC2-readiness preparation for this control surface only.
- [ ] State explicitly: no content provenance (C2PA) shipping.
- [ ] **Budget Wheels consent gate:** `budget_wheels_demo` stays in **Tenant Zero
      sandbox unless the founder confirms consent in writing.** Capture that
      confirmation here: ___________  (leave blank = sandbox only).
- [ ] Test data is **synthetic only** — no real PII, secrets, or customer assets.
- [ ] Install + provider check run:
  ```bash
  pip install -r requirements.txt
  python3 vision_skill.py provider
  ```
- [ ] Verify unit test status in this branch before citing it (do not quote a
      count you haven't run).

## During pilot — what Hermes Vision actually validates

- [ ] Privacy scan on candidate frames:
  ```bash
  python3 vision_skill.py privacy --image <path>
  ```
  - [ ] Confirm `publish_safe` behaves: a visible secret/financial digit forces
        it to `false`.
- [ ] Frame QC before any render/publish:
  ```bash
  python3 vision_skill.py frameqc --frame <path>
  ```
- [ ] Confirm read-only behavior: source files unchanged after runs.
- [ ] Confirm no-post behavior: nothing is published by the skill.
- [ ] Logging is honest: capture real tool output (redacted by the skill); do not
      summarize results as metrics or success rates.

## Exit criteria

- [ ] Prospect has seen the four tools run on their own synthetic samples.
- [ ] Every claim made during the pilot traces to
      [`../trust/claim-provenance.md`](../trust/claim-provenance.md).
- [ ] Open items / planned features recorded **as planned**, not as shipped.
- [ ] Decision recorded without any guarantee of outcomes or metrics.

## Prohibited during the pilot (reminder)

- [ ] No customer names, logos, testimonials, or case studies.
- [ ] No fabricated metrics or "guaranteed results."
- [ ] No "SOC2 certified" / "compliant" / "audited."
- [ ] No crypto/fundraising hype or financial-return language.
- [ ] No implying Budget Wheels is live for a customer.
- [ ] No implying the proof-governed GTM engine, C2PA, or dashboards are
      implemented in this checkout.
