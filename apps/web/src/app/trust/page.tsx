/**
 * V-4 — Public-safe Trust / Proof Explorer (`/trust`).
 *
 * READ-ONLY, static, researcher-facing. No API calls, no auth/token paste, no
 * writes, no private proof bodies, no PII, no internal customer data, no
 * wallet secrets, no token purchase call-to-action, no public marketplace
 * transaction surface. Every claim here is sourced from merged docs on `main`
 * (MAINLINE_RUNTIME_VERIFICATION_STATUS, ECONOMY_SMOKE_001_REPORT,
 * TOKEN_GATES, PUBLIC_DILIGENCE_OVERVIEW) and is intentionally conservative.
 *
 * Doctrine note: this file lives under apps/web, which doctrine guards scan —
 * it deliberately contains no marketing phrasing and no banned literals.
 */

import { CURATED_PROOFS, CURATED_PROOF_NOTE, type EvidenceTag } from './curated-proofs';

type CardStatus = 'built' | 'runtime-verified' | 'design-only' | 'blocked';

interface EvidenceCard {
  name: string;
  status: CardStatus;
  evidence: string;
  claim: string;
  caveat: string;
}

const STATUS_LABEL: Record<CardStatus, string> = {
  built: 'Built',
  'runtime-verified': 'Runtime-verified (local/dev)',
  'design-only': 'Design-only',
  blocked: 'Blocked / founder-gated',
};

const STATUS_COLOR: Record<CardStatus, string> = {
  built: '#1a7f37',
  'runtime-verified': '#0969da',
  'design-only': '#9a6700',
  blocked: '#cf222e',
};

const EVIDENCE_CARDS: EvidenceCard[] = [
  {
    name: 'Agent Trust Credential (ATC)',
    status: 'runtime-verified',
    evidence: 'Migration 0009; live economy smoke (trust-gated acceptance).',
    claim:
      'Each agent holds a verifiable-credential-style identity (issuer / subject / claims / status); revocation is terminal. Designed for compatibility with emerging agent-identity standards via a reserved external-reference field — no custom identifier method.',
    caveat: 'Internal issuer today; external standards anchoring is design-only and gated.',
  },
  {
    name: 'Proof Registry',
    status: 'runtime-verified',
    evidence: 'Migration 0009; append-only triggers; live smoke created proofs.',
    claim:
      'Append-only, evidence-tagged records. Every claim carries verified_fact / likely_inference / unknown; a verified_fact requires an evidence reference and a verifier. Corrections supersede; history is never rewritten. Public exposure requires a passed PII-redaction check.',
    caveat: 'Private proof bodies are never exposed publicly; only redaction-passed projections.',
  },
  {
    name: 'SkillProof',
    status: 'runtime-verified',
    evidence: 'Migrations 0010 / 0013; live smoke upgraded a tier-2 version.',
    claim:
      'Agent skills carry proof tiers; higher tiers require a verified_fact proof to assign. Yanked versions take no new work.',
    caveat: 'Tiers above the verified level are intentionally unassignable in the current version.',
  },
  {
    name: 'Reputation',
    status: 'runtime-verified',
    evidence: 'Migration 0010; live smoke booked +3 on verified release, −2 on dispute refund.',
    claim:
      'Append-only events; a positive change is only admissible against a verified_fact proof. Scores are reproducible from their inputs and are non-transferable, tenant-scoped.',
    caveat: 'Weak-tagged proofs (likely_inference / unknown) move no reputation.',
  },
  {
    name: 'Credits (internal accounting)',
    status: 'runtime-verified',
    evidence: 'Migration 0012; live smoke funded + reserved + released + refunded.',
    claim:
      'A double-entry, append-only accounting ledger. Internal accounting units only — not a currency, not a payment system, not transferable outside the tenant ledger. The only transfer surface is the internal-rail credits transfer.',
    caveat: 'No real money. No external rail. No purchase path.',
  },
  {
    name: 'Work Orders',
    status: 'runtime-verified',
    evidence: 'Migration 0016; live smoke ran the full lifecycle.',
    claim:
      'A governed lifecycle for agent-to-agent work: proposed → accepted → in_progress → delivered → verified / rejected / disputed → resolved. Verified/rejected/canceled/resolved states are terminal.',
    caveat: 'Internal/simulation lab today; not production-deployed.',
  },
  {
    name: 'Escrow Simulation',
    status: 'runtime-verified',
    evidence: 'Migration 0016 trigger; live smoke reserved exactly once and released on verify.',
    claim:
      'Work is escrowed in internal credits and released ONLY against a verified_fact proof — enforced by a database trigger, an in-memory mirror, and the service layer.',
    caveat: 'Simulation only; no real funds; release refused on weak proofs (verified live).',
  },
  {
    name: 'Dispute Resolution',
    status: 'runtime-verified',
    evidence: 'Migration 0017; live smoke held escrow then owner-refunded with a resolution proof.',
    claim:
      'Disputed work holds its escrow; an owner arbitrates release / refund / split, producing an append-only resolution record and a verified_fact resolution proof. Operators cannot arbitrate.',
    caveat: 'Owner-only arbitration; conserved amounts are trigger-checked.',
  },
  {
    name: 'Agent Action Ledger',
    status: 'runtime-verified',
    evidence: 'Existing approval ledger; live smoke filed/approved/executed an accept ask.',
    claim:
      'Agents propose economy actions; humans approve on the governed ledger; a separate operator-gated step executes through the safe path. High-risk economy actions are always approval-required.',
    caveat: 'Verify and dispute-arbitration are never agent-proposable — human owner decisions.',
  },
  {
    name: 'Internal Marketplace',
    status: 'runtime-verified',
    evidence: 'Migration 0018; live smoke listed + ordered + matched.',
    claim:
      'Agents are matched to work by SkillProof tier and reputation. Visibility is internal-only (check-locked). There is no public marketplace and no transaction surface for outside parties.',
    caveat: 'Internal-only; not a public market; no outside transactions.',
  },
  {
    name: 'Cross-tenant Settlement',
    status: 'design-only',
    evidence: 'CROSS_TENANT_SETTLEMENT_DESIGN (internal design doc).',
    claim:
      'A two-ledger clearing model for agent work across tenants, with reputation portability via attestations — designed to preserve tenant isolation.',
    caveat: 'Designed, NOT built. Cross-tenant settlement gate: not passed.',
  },
  {
    name: 'Token Architecture',
    status: 'blocked',
    evidence: 'TOKEN_GATES (all eight gates NOT PASSED); TOKEN_LAB_002 (internal spec).',
    claim:
      "Cognitia's future token architecture is internal, legal-gated, usage-gated, and optional. No public token exists.",
    caveat:
      'Legal, usage, multi-tenant, and security/audit gates all not passed. Token may never launch.',
  },
];

interface GateRow {
  label: string;
  value: string;
}

const TOKEN_GATES: GateRow[] = [
  { label: 'Public token', value: 'No' },
  { label: 'Token launched', value: 'No' },
  { label: 'Liquidity', value: 'No' },
  { label: 'DEX', value: 'No' },
  { label: 'Staking / yield', value: 'No' },
  { label: 'Mainnet', value: 'No' },
  { label: 'Launch date', value: 'None' },
  { label: 'Legal gate', value: 'Not passed' },
  { label: 'Usage gate', value: 'Not passed' },
  { label: 'Cross-tenant settlement gate', value: 'Not passed' },
  { label: 'Managed-Postgres RLS gate', value: 'Not passed' },
  { label: 'Token may never launch', value: 'Correct — optional by design' },
];

const VERIFIED_PATHS: string[] = [
  'listing → work order',
  'Action Ledger accept (approval-required)',
  'escrow reserved exactly once',
  'verified_fact proof on delivery',
  'release + reputation on verify',
  'weak-proof refusal (no release)',
  'dispute → owner refund',
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Is there a public token?', a: 'No. No public token exists.' },
  {
    q: 'Can I acquire a token?',
    a: 'No. There is no token sale and no purchase path of any kind.',
  },
  { q: 'Is there liquidity?', a: 'No liquidity, no DEX, no market.' },
  {
    q: 'Is Cognitia production-ready?',
    a: 'Not production-deployed. The Agent Economy loop is runtime-verified on a local/dev Postgres engine only.',
  },
  {
    q: 'Is Cognitia SOC 2 certified?',
    a: 'No. Cognitia is not SOC 2 certified and makes no certification claim.',
  },
  {
    q: 'What is actually verified?',
    a: 'The full Agent Economy loop (listing → order → ledger accept → escrow reserve → delivery proof → verify release + reputation, plus weak-proof refusal and dispute refund) was run live against a real Postgres engine in local/dev through the production handlers and repository.',
  },
  {
    q: 'What is still blocked?',
    a: 'Engine-level row-level-security under a restricted non-superuser role on a managed database is not yet verified (a ready-to-run plan exists, pending a dev database). Production usage, an external security audit, and any token step remain founder-gated.',
  },
  {
    q: 'Why does the token not launch now?',
    a: 'Because it should not. The token is optional and behind a full set of gates — product, usage, multi-tenant, legal, compliance, utility, security/audit, communications — none of which are passed. Utility is earned by the platform economy working first, then mapped — never the reverse.',
  },
  {
    q: 'What makes the token potentially useful later?',
    a: 'A possible future role is assurance collateral (bonding) for verifiers, publishers, workers, and disputes — collateral that must be at risk to mean something, which internal credits cannot honestly provide. This is internal design only and earns no yield.',
  },
  {
    q: 'What evidence exists?',
    a: 'Append-only, evidence-tagged proofs; a full test suite; a live runtime smoke; and merged status documents. Verifiable, externally-published surfaces are on the roadmap.',
  },
];

const sectionStyle = { margin: '28px 0' } as const;
const h2Style = { fontSize: 20, borderBottom: '2px solid #d0d7de', paddingBottom: 6 } as const;
const mutedStyle = { color: '#57606a' } as const;

const TAG_COLOR: Record<EvidenceTag, string> = {
  verified_fact: '#1a7f37',
  likely_inference: '#9a6700',
  unknown: '#57606a',
};

function TagPill({ tag }: { tag: EvidenceTag }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        background: TAG_COLOR[tag],
        borderRadius: 4,
        padding: '2px 8px',
      }}
    >
      {tag}
    </span>
  );
}

function StatusPill({ status }: { status: CardStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        background: STATUS_COLOR[status],
        borderRadius: 4,
        padding: '2px 8px',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export const metadata = {
  title: 'Cognitia Trust & Proof',
  description:
    'Proof-backed agent economy diligence surface: a read-only, public-safe view of what Cognitia has built, what is runtime-verified, what is design-only, and why any future token remains internal and gated. No public token exists.',
};

export default function TrustExplorerPage() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24, lineHeight: 1.55 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Cognitia — Trust / Proof Explorer</h1>
      <p style={mutedStyle}>
        Read-only. Public-safe. No private proof bodies, no customer data, no token purchase path.
        This page is a conservative, evidence-tagged snapshot for technical evaluators.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Cognitia Trust Overview</h2>
        <p>
          Cognitia is an agent trust, execution, and (internal) economy platform: it gives AI agents
          a verifiable identity, an append-only record of proven work, and a governed way to
          transact with each other — with evidence discipline at the core. Reputation and value
          movement happen only against a <code>verified_fact</code> proof. Vertical deployments are
          proof environments that exercise the platform; they are not the destination.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What is built · runtime-verified · design-only · blocked</h2>
        <ul>
          <li>
            <strong>Built &amp; runtime-verified (local/dev):</strong> ATC, Proof Registry,
            SkillProof, Reputation, internal Credits, Work Orders, Escrow Simulation, Dispute
            Resolution, Agent Action Ledger, Internal Marketplace.
          </li>
          <li>
            <strong>Design-only:</strong> Cross-tenant settlement / clearing; reputation
            portability; external standards anchoring.
          </li>
          <li>
            <strong>Blocked / founder-gated:</strong> any token step; production deployment;
            external security audit; engine-level RLS verification on managed Postgres.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Runtime Verification Status</h2>
        <ul>
          <li>
            Local/dev runtime smoke: <strong>passed</strong>.
          </li>
          <li>
            Latest known test result: <strong>443/443 green</strong> (full suite).
          </li>
          <li>
            Migration chain verified locally: <strong>0001–0014</strong> and{' '}
            <strong>0016–0018</strong>; <strong>0015 reserved/absent</strong> (held for a separate
            deferred workstream).
          </li>
        </ul>
        <p style={{ marginBottom: 4 }}>Verified paths:</p>
        <ul>
          {VERIFIED_PATHS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p
          style={{
            background: '#fff8c5',
            border: '1px solid #d4a72c',
            padding: 10,
            borderRadius: 6,
          }}
        >
          <strong>Caveat:</strong> Managed-Postgres row-level security under a restricted
          (non-superuser) role is <strong>not yet verified</strong>. The local engine used for the
          smoke runs as a superuser, which bypasses row-level security; a ready-to-run verification
          plan exists, pending a dedicated dev database.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Token Architecture Status</h2>
        <p
          style={{
            background: '#ffebe9',
            border: '1px solid #cf222e',
            padding: 10,
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Cognitia&apos;s future token architecture is internal, legal-gated, usage-gated, and
          optional. No public token exists.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <tbody>
            {TOKEN_GATES.map((g) => (
              <tr key={g.label} style={{ borderBottom: '1px solid #eaeef2' }}>
                <td style={{ padding: '6px 8px' }}>{g.label}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{g.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Evidence Cards</h2>
        {EVIDENCE_CARDS.map((c) => (
          <div
            key={c.name}
            style={{
              border: '1px solid #d0d7de',
              borderRadius: 8,
              padding: 14,
              margin: '10px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <strong>{c.name}</strong>
              <StatusPill status={c.status} />
            </div>
            <p style={{ margin: '8px 0 4px' }}>{c.claim}</p>
            <p style={{ margin: '4px 0', fontSize: 14 }}>
              <strong>Evidence:</strong> <span style={mutedStyle}>{c.evidence}</span>
            </p>
            <p style={{ margin: '4px 0', fontSize: 14 }}>
              <strong>Caveat:</strong> <span style={mutedStyle}>{c.caveat}</span>
            </p>
          </div>
        ))}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Public-safe Proof Samples</h2>
        <p style={mutedStyle}>{CURATED_PROOF_NOTE}</p>
        <p style={mutedStyle}>
          Each row shows only the public projection — id, kind, evidence tag, public summary,
          supersession link, and date. No private proof bodies, no PII, no customer or tenant data.
          Only <code>verified_fact</code> entries move reputation or release value; weaker tags (
          <code>likely_inference</code>, <code>unknown</code>) confer nothing. For live,
          redaction-passed projections once a public tenant is configured, see{' '}
          <a href="/trust/live">/trust/live</a>.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
              <th style={{ padding: 6 }}>Sample</th>
              <th style={{ padding: 6 }}>Kind</th>
              <th style={{ padding: 6 }}>Evidence tag</th>
              <th style={{ padding: 6 }}>Public summary</th>
              <th style={{ padding: 6 }}>Supersedes</th>
              <th style={{ padding: 6 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {CURATED_PROOFS.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eaeef2', verticalAlign: 'top' }}>
                <td style={{ padding: 6 }}>
                  <code>{p.id}</code>
                </td>
                <td style={{ padding: 6 }}>{p.kind}</td>
                <td style={{ padding: 6 }}>
                  <TagPill tag={p.evidence_tag} />
                </td>
                <td style={{ padding: 6 }}>{p.summary_public}</td>
                <td style={{ padding: 6 }}>
                  {p.supersedes_proof_id ? <code>{p.supersedes_proof_id}</code> : '—'}
                </td>
                <td style={{ padding: 6 }}>{p.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Researcher FAQ</h2>
        {FAQ.map((f) => (
          <div key={f.q} style={{ margin: '10px 0' }}>
            <p style={{ fontWeight: 600, margin: '0 0 2px' }}>{f.q}</p>
            <p style={{ margin: 0 }}>{f.a}</p>
          </div>
        ))}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Researcher resources</h2>
        <p style={mutedStyle}>
          A public-safe diligence pack lives in the repository under{' '}
          <code>docs/cognitia/public/</code> (and <code>SECURITY.md</code> at the repo root). These
          are documents, not token pages — there is no purchase path here.
        </p>
        <ul>
          <li>
            <code>RESEARCHER_PACK.md</code> — single starting point: what is built, verified,
            design-only, and blocked.
          </li>
          <li>
            <code>VERIFY_IT_YOURSELF.md</code> — clone the repo and reproduce the test suite and the
            runtime economy smoke locally.
          </li>
          <li>
            <code>SECURITY.md</code> — security disclosure posture, scope, and secrets policy.
          </li>
          <li>
            <code>TOKEN_STATUS_AND_GATES.md</code> — token status (none) and the gates that remain
            not passed.
          </li>
          <li>
            <code>CLAIMS_WE_DO_NOT_MAKE.md</code> — the claims Cognitia deliberately refuses.
          </li>
          <li>
            <code>RESEARCHER_REVIEW_ORDER.md</code> and <code>STANDARDS_ALIGNMENT.md</code> — a
            suggested review path and the standards mapping (compatible-by-design, not built).
          </li>
          <li>
            <code>THREAT_MODEL.md</code>, <code>GOVERNANCE_POSTURE.md</code>,{' '}
            <code>TRUST_BOUNDARIES.md</code>, and <code>RISK_REGISTER_PUBLIC.md</code> — what can go
            wrong, who decides, what crosses boundaries, and the open risks (honestly disclosed).
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What Cognitia does not claim</h2>
        <ul>
          <li>No public token; no token sale; no purchase path.</li>
          <li>No liquidity, no DEX, no staking or yield product.</li>
          <li>No mainnet deployment; no real payments; no external value transfers.</li>
          <li>No price or return statements of any kind.</li>
          <li>Not SOC 2 certified; not production-deployed.</li>
          <li>No guarantee any token will ever exist.</li>
        </ul>
      </section>

      <p style={{ ...mutedStyle, fontSize: 13, marginTop: 32 }}>
        Sources (in-repo, merged): runtime verification status, economy smoke report, token gates,
        and the public diligence overview. This page is maintained as a public-safe summary and is
        intentionally conservative.
      </p>
    </main>
  );
}
