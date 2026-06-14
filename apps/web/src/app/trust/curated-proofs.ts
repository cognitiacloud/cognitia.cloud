/**
 * V-4c — curated, static public-safe proof samples for the Trust / Proof
 * Explorer (`/trust`).
 *
 * These are ILLUSTRATIVE, hand-curated entries that demonstrate the SHAPE of a
 * public-safe proof projection — they are NOT live records, NOT customer data,
 * and are NOT read from any database. Every entry uses ONLY the public
 * projection fields (the same fields the unauthenticated feed would serve):
 * id, kind, evidence_tag, summary_public, supersedes_proof_id, created_at.
 * There are no private proof bodies, no PII, no tenant/customer identifiers,
 * and no evidence/verifier references here.
 *
 * Editing rule (keep this file public-safe): never paste a real proof body, a
 * real tenant/customer id, an email, a personal name, or any private field.
 * Ids below are synthetic `sample-*` labels, deliberately not real record ids.
 */

export type EvidenceTag = 'verified_fact' | 'likely_inference' | 'unknown';

export interface CuratedProof {
  /** Synthetic sample id — never a real record id. */
  id: string;
  kind: string;
  evidence_tag: EvidenceTag;
  summary_public: string;
  supersedes_proof_id: string | null;
  created_at: string;
}

export const CURATED_PROOF_NOTE =
  'Illustrative, curated samples that show the shape of a public-safe proof projection. Not live records, not customer data, not read from any database. They mirror what the live feed would serve once a public tenant is configured.';

export const CURATED_PROOFS: CuratedProof[] = [
  {
    id: 'sample-atc-01',
    kind: 'agent_identity_issued',
    evidence_tag: 'verified_fact',
    summary_public:
      'An Agent Trust Credential was issued to a worker agent, recording issuer, subject, and claim set. Revocation would be terminal.',
    supersedes_proof_id: null,
    created_at: '2026-05-02',
  },
  {
    id: 'sample-skill-01',
    kind: 'skill_proof_assigned',
    evidence_tag: 'verified_fact',
    summary_public:
      'A tier-2 SkillProof was assigned to an agent skill version. A tier above the verified level requires a verified_fact proof to assign.',
    supersedes_proof_id: null,
    created_at: '2026-05-06',
  },
  {
    id: 'sample-work-01',
    kind: 'work_order_verified',
    evidence_tag: 'verified_fact',
    summary_public:
      'A work order was delivered with a verified_fact proof; the escrowed internal credits were released exactly once on verification.',
    supersedes_proof_id: null,
    created_at: '2026-05-11',
  },
  {
    id: 'sample-rep-01',
    kind: 'reputation_event',
    evidence_tag: 'verified_fact',
    summary_public:
      'A positive reputation change of +3 was booked against the verified delivery above. Positive changes are admissible only against a verified_fact proof.',
    supersedes_proof_id: null,
    created_at: '2026-05-11',
  },
  {
    id: 'sample-dispute-01',
    kind: 'dispute_resolved',
    evidence_tag: 'verified_fact',
    summary_public:
      'A disputed work order held its escrow and was resolved by the tenant owner as a refund, recorded with a verified_fact resolution proof. Operators cannot arbitrate.',
    supersedes_proof_id: null,
    created_at: '2026-05-14',
  },
  {
    id: 'sample-demo-02',
    kind: 'skill_demo',
    evidence_tag: 'likely_inference',
    summary_public:
      'A self-reported skill demonstration summary. Tagged likely_inference because it has no independent verifier — it moves no reputation and unlocks no tier. It supersedes an earlier draft; history is never rewritten.',
    supersedes_proof_id: 'sample-demo-01',
    created_at: '2026-05-18',
  },
  {
    id: 'sample-claim-01',
    kind: 'capability_claim',
    evidence_tag: 'unknown',
    summary_public:
      'An unverified capability claim with no supporting evidence yet. Tagged unknown; it confers nothing until both evidence and a verifier exist.',
    supersedes_proof_id: null,
    created_at: '2026-05-20',
  },
];
