# First-Wave Release Checklist — Client Zero (W7)

Run this before promoting the Hermes vision spine into any Client Zero / Demandara
environment. The hard gate is simple: **the first wave ships with no real
outreach surface and no accidental live egress.**

## Hard gates (must all be ✅ — CI enforces)

- [ ] **No real outreach.** `NoOutreachSurfaceTests` green — no mail/SMS/social
      send surface and no live-vendor SDK in `vision_skill.py`.
- [ ] **Egress confined.** `EgressConfinementTests` green — network calls live
      only inside the known provider functions.
- [ ] **Mock-safe proven.** `MockSafeNoNetworkTests` green — `ocr_only` runs all
      four tools with zero network egress.
- [ ] **Safety flags intact.** `SafetyContractTests` green — `read_only`,
      `no_delete`, `no_post`, `no_unknown_uploads`, `redact_logs` still `true`;
      `ocr_only` still the fallback provider.
- [ ] **PII never leaks.** `test_pii_redaction.py` green — secrets redacted in
      output and logs; visible secrets force `reject_publish_secrets_visible`.
- [ ] **Functional suite.** `test_vision_skill.py` green.

```bash
cd hermes/skills/vision-skill
python3 test_enterprise_guard.py && python3 test_pii_redaction.py && python3 test_vision_skill.py
```

## Configuration gates

- [ ] Default deployment sets `HERMES_VISION_PROVIDER=ocr_only` unless a live
      provider is **deliberately** required for that environment.
- [ ] No `*_API_KEY` is baked into images, configs, or the repo — keys come from
      the environment only (`git grep` for `sk-`, `AKIA`, `ghp_` returns nothing).
- [ ] If a live provider IS enabled, the owner of that environment has signed off
      on third-party image egress (see POLICY_CONTRACT.md → mock/live boundary).

## Documentation gates

- [ ] `ENTERPRISE_HARDENING.md` status tags reviewed; every `[placeholder]` /
      `[documented-gap]` is acceptable for this wave or has a follow-up ticket.
- [ ] `POLICY_CONTRACT.md` capability table matches the tools actually exposed.

## Sign-off

- [ ] Reviewer confirms no change in this release adds a write/send/post surface
      or weakens a safety flag. Any such change requires explicit human sign-off
      recorded in the PR (change-control, POLICY_CONTRACT.md).
