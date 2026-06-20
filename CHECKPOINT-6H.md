# 6-Hour Checkpoint — ep002 / Hermes Vision QC

Scope: this checkpoint covers the **ep002 / Hermes Vision QC branch only**. It is not a checkpoint
for the whole Cognitia mission. Statements about artifacts refer to **this checked-out workspace**;
other branches (a large number may be unmerged) are not assessed here.

Entity model: Cognitia = agent trust/control plane, proof registry, compliance layer, Sales
Closer/GTM OS, agent-economy infra. Demandara = GTM/growth/operator layer. Hermes Vision Skill =
one supporting media/publish-safety artifact.

## Worker 1 — Hermes Vision QC  [SHIPPED]
Path: `hermes/skills/vision-skill/`

1. Completed artifacts: `vision_skill.py` (677 LOC: 4 tools, 5 LLM providers + OCR fallback, CLI +
   MCP stdio server), `test_vision_skill.py` (13 passing), `skill.yaml`, `.mcp.json`, `README.md`,
   `requirements.txt`, `test_assets/` (6 synthetic images + generator). Commit 0dfb0ad.
2. Best findings: privacy gate runs with zero cloud dependency — OCR+regex detects 10 secret
   classes and forces `publish_safe=false` / `reject_publish_secrets_visible`. Provider routing
   degrades to `ocr_only`; the publish-blocking path needs no API key. Log redaction scrubs
   secrets before stderr.
3. Weakest assumptions: (a) Tesseract reliably reads stylized/low-contrast frame text (often
   false; missed text = missed secret); (b) `ocr_only` mode still emits judgments though it lacks
   real vision (defaults to `reject`, so non-functional, not safe); (c) regex over-flags
   (`@handle`, 13-16 digit runs) and under-matches intl phones; (d) only the first/thumbnail frame
   is QC'd.
4. Roadmap changes: make "LLM provider configured" required for any auto publish decision; OCR-only
   gates to manual review. Add multi-frame sampling.
5. Risks: false safety in `ocr_only`; silent OCR failure returns empty string => `publish_safe=true`;
   no cost/rate guard on provider calls; `ffmpeg`/`tesseract` deps unenforced at load.
6. Stop: stop adding providers (5 is over-scoped for one consumer); stop treating OCR-only as
   publish-capable.
7. Continue: read-only / no-post / redaction posture; SDK-free urllib design; keyless-runnable tests.
8. Next 6h: multi-frame sampling + fail-closed on empty OCR; confidence-thresholded human-review
   queue; golden-image regression set; (generator integration deferred — see Worker 2).
9. Files/artifacts created: all under `hermes/skills/vision-skill/`.

## Worker 2 — Avatar / Video Generation (HeyGen)  [NOT IN REPO]
1. Completed artifacts: none visible in this workspace. README references a sibling
   `~/.hermes/skills/heygen-skills/`; not assessed here.
2. Best findings: the Vision worker already encodes its half of the contract (founder-avatar
   selection, `main_avatar|backup_reference|reject`, 9:16 safe zones).
3. Weakest assumption: that this worker exists and is compatible — unverified in this workspace.
4. Roadmap change: treat a media-pipeline lane as a **future decision requiring manager approval**,
   not an immediate action. Do NOT pull the HeyGen worker into this repo yet.
5. Risks: integration drift if the contract moves; media lane is out of scope until approved.
6. Stop: do not build more Vision features against an unconfirmed HeyGen contract.
7. Continue: keep the QC schema surface stable so a future seam stays cheap.
8. Next 6h: none unless the media-pipeline lane is approved.
9. Files/artifacts created: none.

## Workers 3-5 — Orchestration/Pipeline, Distribution/Publishing, GTM+Compliance  [UNSTARTED]
No artifacts visible in this workspace. These belong to the broader Cognitia/Demandara mission, not
this branch. Reported as not started **here** (other branches not assessed).

## Top 5 founder decisions
1. Confirm the entity boundaries above are how artifacts get filed (Cognitia control-plane vs.
   Demandara GTM vs. Hermes media-safety) so checkpoints stop conflating them.
2. Approve or decline a media-pipeline lane before any HeyGen integration work.
3. Human-in-the-loop vs. auto publish for the media-safety gate — recommend human approve until
   QC false-negative rate is measured.
4. Where the Hermes Vision skill is filed long-term (standalone safety artifact vs. folded into a
   Cognitia compliance-layer module).
5. Whether the large set of unmerged branches needs a consolidation/triage pass before more lanes open.

## Top 5 security / compliance warnings
1. `ocr_only` mode makes publish decisions with no real vision — must fail closed to manual review.
2. Silent OCR failure => `publish_safe=true` (empty OCR currently reads as "clean").
3. Single-frame QC misses secrets/faces in the rest of a video.
4. No consent/retention/revocation record for any portrait used as an avatar.
5. No spend/rate guard on provider calls; secret-scan precision unproven on a real corpus before
   trusting auto-reject.

## Top 5 build priorities (next 6h, this branch)
1. Fail-closed QC: empty/low-confidence OCR and `ocr_only` => manual_review, never auto-pass.
2. Multi-frame sampling in `video_frame_qc` (N evenly-spaced frames, worst case wins).
3. Confidence-thresholded human-review queue keyed on `recommended_action`.
4. Golden-image regression set for the privacy/secret detectors.
5. Enforce `ffmpeg`/`tesseract` presence at load with a clear error.

## Top 5 things NOT to build yet
1. HeyGen / media-pipeline integration (pending manager approval of the lane).
2. More vision providers (5 already too many for one consumer).
3. Auto-publish to platforms (no human gate, FN rate unmeasured).
4. Multi-platform distribution.
5. Custom/self-hosted vision models — OCR + hosted APIs suffice now.
