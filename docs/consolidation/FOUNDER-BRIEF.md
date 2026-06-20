# FOUNDER BRIEF — for Muhammad & Feroz

**Date:** 2026-06-20 · Plain-English summary. Details in the other files in this folder.

---

## The one-paragraph version

The parallel build sessions worked. The **core Sales Closer foundation is now merged into `main`** — the data layer, the privacy-safe prospect model, the data-source strategy, and the compliance spec are all landed and verified. The compliance _implementation_ (#96) is now **merged into `main`** (UI/helper/demo-only — web app + docs, no core/DB/vendor changes). One more piece (#99, the Apify data-ingestion scaffold) needs a quick technical re-pointing because the branch it was built on has since merged. Everything else is either a useful draft we keep on the shelf (Client Zero proposal, goal-loop harness, strategy reports) or deliberately parked (agent economy, crypto, token). **The job this week is to converge and approve what exists — not to build more.**

---

## What we achieved (verified)

- **A real, canonical Sales Closer spine is on `main`:**
  - The closer **database layer** — five governed tables, tenant isolation, privacy guards (#93).
  - The **privacy-safe prospect model** — no raw emails/phones ever stored, only hashes/masks/domain (#97).
  - The **data-source strategy** and the **compliance spec** — what we may collect, consent rules, channel rules (#91, #92).
  - The **vendor porting plan** — which prototype thinking to reuse, what to discard (#98).
- **The compliance layer is merged** (#96): merged to `main` on 2026-06-20 (merge `d3d198e7`) as UI/helper/demo-only — it reuses the merged foundation, adds no duplicate code, touches no `packages/core`/DB/vendor, and passed its full test suite.
- **A complete Client Zero (dealership) proposal package exists** (#106) — proposal, discovery questionnaire, call scripts, and a working static console — built to be re-run for the next dealership, with guardrails baked in (no guaranteed sales/ROI).
- **Discipline held:** no public token, no real outreach, no paid ads, no live vendor calls, no raw customer data anywhere. The risky lanes were correctly parked.

## What remains

1. ✅ **Compliance layer (#96) — merged** to `main` (done; no further action).
2. **Re-point the Apify ingestion (#99)** — small technical fix (its base branch merged), then review.
3. **Pick the "winner" branch** where we have duplicates (e.g. three dealership lanes, four lead-detail lanes) so we stop spreading effort.
4. **Decide on Client Zero** — is there a real dealership that has agreed, or do we keep this as a polished pitch for now?
5. **Name a compliance sign-off person** — needed before anything goes live (not before, since nothing is live yet).

## What to do next (this week)

- **Day 1:** ✅ done — #96 (compliance) merged to `main`; capacity rolls to #99.
- **Day 2:** re-point and re-test #99 (Apify).
- **Day 3:** ratify the canonical branch picks; mark the duplicates "superseded" (don't delete).
- **Day 4:** review the Client Zero package (#106); decide if a real dealership exists.
- **Days 5–7:** read the whole spine end-to-end, triage the leftover drafts, and check nothing parked got switched back on.

## The 5 decisions only you can make (from #100)

1. **Confirm automotive dealership as the sole near-term beachhead** (yes/no).
2. **Confirm a flat pilot fee** and park performance-share pricing (yes/no).
3. **Confirm the public token stays killed** (recommended: yes).
4. **Name the legal/compliance sign-off owner** (blocks any outreach/ads later).
5. **Confirm whether a consenting Client Zero dealership exists** — or keep everything spec-only.

## The honest caveats

- "Merged" is verified for the five foundation PRs. For older **closed** PRs we did **not** assume they merged — GitHub's bulk data is unreliable there, so we marked them unverified rather than guess.
- Branch-to-workstream mapping is **inference from names and PR descriptions**, not a line-by-line content audit, except where a file was actually read (noted in the files).
- **Nothing is production-ready** beyond what CI/tests verify. No live claims.
