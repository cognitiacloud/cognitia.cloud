# V2-10 Manager 2 Technical Review Packet

## Scope
`packages/demandara-sales-closer` local mock Demandara Sales Closer / Budget Wheels product spine.

## Current SHAs
- Baseline product spine: `14611d9d4df7`
- Hardening wave: `700b0b24e644`
- V2 wave: see current branch HEAD in report.

## Files to inspect
- `demandara_sales_closer/spine.py`
- `tests/test_spine.py`
- `fixtures/*.json`
- `static/operator-console-viewer.html`
- `docs/REAL_SIGNATURE_APPROVAL_MODEL_DESIGN.md`
- `docs/PILOT_READINESS_GAP_LIST.md`
- `docs/CLAIM_SAFE_DEMO_LANGUAGE.md`

## Tests
Run:
`PYTHONPATH=packages/demandara-sales-closer python3 -m unittest discover -s packages/demandara-sales-closer/tests -p 'test_*.py' -v`

## Known explicit risk
Local-demo approval receipt binding is not real identity/auth/signature. Controlled-live remains blocked.

## Questions for Manager 2
1. Is the approval signature design sufficient as a controlled-live roadmap without secrets?
2. Is the static proof viewer claim-safe and endpoint-free?
3. Is the package too broad for one PR, or should it split into core/fixtures/viewer/docs?
4. Are there hidden overclaims in demo language?
5. What is the minimum next hardening before a founder demo?
