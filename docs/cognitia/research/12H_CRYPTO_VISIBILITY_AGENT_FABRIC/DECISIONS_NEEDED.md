# DECISIONS_NEEDED — 12H Sprint (founder)

Decisions only the founder can make. None block the research/docs work; all block
specific downstream builds.

| ID  | Decision                                               | Why it matters                                                             | Recommendation                                                                                    |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D-1 | Paste the target video transcript (or confirm "skip")  | LOOP 1 could not fetch it; framework is independent until reconciled       | Paste transcript into `video/TRANSCRIPT.md`; I'll reconcile against `VIDEO_RESEARCH_FRAMEWORK.md` |
| D-2 | Provide a dev `DATABASE_URL`                           | Unblocks V-6 managed-Postgres RLS verification (a real diligence checkbox) | Provide a throwaway dev DB; run the existing plan                                                 |
| D-3 | Approve a public **researcher pack** going live        | Highest-leverage visibility move; needs founder voice/sign-off             | Approve the spec in `PUBLIC_RESEARCHER_PACK_SPEC.md`; keep token gates loud                       |
| D-4 | Public team page (identity)                            | Anonymous team is a top researcher red flag                                | Decide name/handle exposure; draft is design-only                                                 |
| D-5 | Engage counsel on future token (BC/Canada + US)        | Token stays gated until legal opinion exists                               | Use the existing counsel pack; no token work until opinion                                        |
| D-6 | Authorize (or keep frozen) TOKEN-LAB-003 local sandbox | Local-only throwaway spike; still founder-gated                            | Keep frozen until D-5 progresses                                                                  |
| D-7 | Default branch → `main`                                | Researchers browse the default branch first                                | One-click in GitHub settings                                                                      |
| D-8 | Configure `COGNITIA_PUBLIC_TENANT_ID` (publish feed)   | Makes `/trust/live` non-empty with curated public-safe proofs              | Only after V-6 + trustProxy + edge limits (per V-5 plan)                                          |
