# Sales Closer Proof Report Generator (W5 Proof Harness)

Proof layer for Cognitia/Demandara "Client Zero". It takes the output of one
**completed, mock-safe Sales Closer** workflow run and emits a **proof report**
an auditor can read to see what actually happened — clearly separating
**verified facts**, **likely inference**, and **unknown**, and including the
**human approval** record.

It is self-contained: it imports nothing from the sibling `vision-skill` and
modifies no files outside this directory.

## Workflow stages covered

`lead_intake` → `compliance_decision` → `approval` → `appointment_mock` →
`crm_mock`. Each stage contributes at least one evidence entry.

## Classification taxonomy

| Classification     | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `verified`         | A fact directly recorded in the workflow output (sourced).     |
| `likely_inference` | A derived/heuristic read; carries a `confidence` (0–1).        |
| `unknown`          | Data not captured / indeterminate from the workflow output.    |

## Safety guarantees (enforced fail-closed)

- **No raw PII** in the proof output. The proof references the lead only by an
  opaque pseudonymous id (`SC-LEAD-0001`); contact fields are never copied. The
  serialized report is scanned for emails/phones/keys/paths/financial data
  before emit and the generator **raises** rather than emit anything unsafe.
- **No real customer data.** The fixture is synthetic (`mode: mock_safe`,
  reserved `.invalid`/`.test` TLDs, `555-01xx` numbers).
- **No public-token / blockchain language.** Integrity uses a plain local
  SHA-256 `content_checksum` for tamper-evidence — never a "token"/"ledger"/
  "chain". A lexical guard rejects that vocabulary.

PII regexes mirror the established patterns in
`hermes/skills/vision-skill/vision_skill.py`.

## Usage

```bash
# Generate a proof report from the bundled fixture (prints JSON):
python3 proof_report.py generate

# Write to a file:
python3 proof_report.py generate --fixture fixtures/sales_closer_completed.json \
    --out sample_output/proof_report.sample.json

# Validate that a fixture produces a safe report:
python3 proof_report.py validate
```

## Tests

```bash
python3 test_proof_report.py
```

Tests assert: no raw PII in output (and the fixture's fake contact strings are
absent), every evidence entry has the required fields, all five stages are
covered, the taxonomy contains verified/likely_inference/unknown with matching
summary counts, the human approval record is present, no forbidden language
appears, the integrity checksum is deterministic, and the generator fails
closed on PII leaks, forbidden language, or incomplete workflows.

## Layout

```
proof-report/
├── README.md
├── proof_report.py                       # schema/contract + generator + CLI
├── fixtures/sales_closer_completed.json   # one completed, mock-safe run
├── sample_output/proof_report.sample.json # checked-in example output
└── test_proof_report.py
```
