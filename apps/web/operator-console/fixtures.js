/*
 * Client Zero — Sales Closer operator console FIXTURES.
 *
 * SAFETY: 100% synthetic. No real prospect data, no live outreach, no vendor
 * APIs. All emails use the reserved `.example` TLD (RFC 2606) and all phone
 * numbers use the reserved 555-01xx range (NANP fictional block). Replace this
 * module with the workflow-core adapter described in README.md to go live.
 *
 * This file intentionally contains NO finance / APR / approval-odds claims.
 */

/* eslint-disable */
window.CLIENT_ZERO_FIXTURES = {
  // Marks the data source so the UI can render a "MOCK DATA" banner. The real
  // adapter MUST set this to "workflow-core" so operators can never confuse a
  // rehearsal with a live lead.
  source: "mock-fixtures",
  generatedAt: "2026-06-21T14:02:00Z",

  leads: [
    {
      id: "LEAD-CZ-0001",
      // --- Lead detail (synthetic) ---
      name: "Jordan Rivera",
      company: "Northwind Roofing Co. (example)",
      role: "Owner / GM",
      email: "jordan.rivera@northwind-roofing.example",
      phone: "+1 (555) 0142",
      timezone: "America/Denver",
      source: "Inbound web form (sandbox)",
      stage: "Qualified — pending human approval",
      intent:
        "Requested a callback about a new commercial roof estimate for a warehouse.",
      consent: {
        // Demonstrates an explicit, recorded consent state. No outreach may be
        // sent unless consent === "granted" AND compliance state is approvable.
        marketing: "granted",
        recordedAt: "2026-06-20T17:40:00Z",
        basis: "Web form opt-in (sandbox capture)",
      },

      // --- Compliance state ---
      compliance: {
        state: "NEEDS_REVIEW", // PASS | NEEDS_REVIEW | BLOCKED
        summary:
          "Draft passed automated screens but requires human sign-off before any send.",
        // Block / reason codes surfaced to the operator.
        reasons: [
          {
            code: "HUMAN_APPROVAL_REQUIRED",
            severity: "block",
            label: "Human approval required",
            detail:
              "Policy gate: every outbound draft for Client Zero requires an operator to approve before it can be queued. This is a hard gate.",
          },
          {
            code: "CLAIM_SCAN_CLEAR",
            severity: "info",
            label: "No finance/APR/approval claims detected",
            detail:
              "Automated claim scanner found no APR, financing, guarantee, or approval-odds language in the draft.",
          },
        ],
      },

      // --- Draft summary preview (NOT sent — preview only) ---
      draft: {
        channel: "email",
        status: "preview_only", // never auto-sends
        subject: "Following up on your warehouse roof estimate request",
        previewSummary:
          "Warm, plain-language follow-up that references the inbound request, offers two example call windows, and asks the prospect to confirm a time. Contains no pricing, financing, or guarantee language.",
        body: [
          "Hi Jordan,",
          "",
          "Thanks for reaching out about an estimate for the warehouse roof. " +
            "I'd love to set up a quick call so we can understand the scope and " +
            "answer any questions.",
          "",
          "Would either of these work for a 15-minute call?",
          "  • Tue 10:00 AM MT",
          "  • Wed 2:00 PM MT",
          "",
          "If another time is easier, just reply and let me know.",
          "",
          "Best,",
          "The Northwind team (sandbox)",
        ].join("\n"),
        wordCount: 74,
        generatedBy: "draft-composer (mock)",
        claimScan: {
          financeTerms: 0,
          aprTerms: 0,
          approvalOddsTerms: 0,
          guaranteeTerms: 0,
        },
      },

      // --- Appointment / CRM mock status ---
      appointment: {
        provider: "mock-scheduler",
        status: "proposed", // proposed | confirmed | none
        proposedSlots: ["2026-06-23T16:00:00Z", "2026-06-24T20:00:00Z"],
        confirmedSlot: null,
        note: "Slots are placeholders rendered from fixtures. No calendar API is called.",
      },
      crm: {
        provider: "mock-crm",
        status: "synced_dry_run", // synced_dry_run | pending | error | not_synced
        recordId: "CRM-EX-559001",
        lastSyncedAt: "2026-06-21T13:58:00Z",
        note: "Dry-run write only. The live adapter would push to the real CRM after approval.",
      },

      // --- Proof log panel (append-only audit trail) ---
      proofLog: [
        {
          ts: "2026-06-20T17:40:02Z",
          actor: "system",
          event: "lead.ingested",
          detail: "Lead captured from sandbox web form.",
          hash: "f3a1…0b7c",
        },
        {
          ts: "2026-06-20T17:40:05Z",
          actor: "system",
          event: "consent.recorded",
          detail: "Marketing consent = granted (web form opt-in).",
          hash: "9c22…41de",
        },
        {
          ts: "2026-06-21T13:55:10Z",
          actor: "system",
          event: "draft.composed",
          detail: "Draft email composed (preview only, not sent).",
          hash: "ab90…77f1",
        },
        {
          ts: "2026-06-21T13:55:12Z",
          actor: "system",
          event: "compliance.scanned",
          detail:
            "Claim scan clear; gate set to HUMAN_APPROVAL_REQUIRED.",
          hash: "2e54…c003",
        },
        {
          ts: "2026-06-21T13:58:00Z",
          actor: "system",
          event: "crm.dry_run",
          detail: "CRM dry-run write CRM-EX-559001.",
          hash: "6b18…aa29",
        },
      ],
    },

    {
      id: "LEAD-CZ-0002",
      name: "Sam Okonkwo",
      company: "Cedar & Co. HVAC (example)",
      role: "Operations Lead",
      email: "sam.okonkwo@cedar-co-hvac.example",
      phone: "+1 (555) 0188",
      timezone: "America/Chicago",
      source: "Referral (sandbox)",
      stage: "Blocked — compliance",
      intent: "Asked whether financing is available for a full system replacement.",
      consent: {
        marketing: "unknown",
        recordedAt: null,
        basis: "No recorded opt-in",
      },
      compliance: {
        state: "BLOCKED",
        summary:
          "Draft blocked: missing consent and a prohibited finance claim was detected. No send possible.",
        reasons: [
          {
            code: "CONSENT_MISSING",
            severity: "block",
            label: "Consent not recorded",
            detail:
              "No marketing consent on file. Outreach is blocked until consent is captured and verified.",
          },
          {
            code: "FINANCE_CLAIM_DETECTED",
            severity: "block",
            label: "Prohibited finance/APR language",
            detail:
              "Draft referenced financing/APR terms. Client Zero policy prohibits any finance, APR, or approval-odds claims in outreach.",
          },
          {
            code: "HUMAN_APPROVAL_REQUIRED",
            severity: "block",
            label: "Human approval required",
            detail: "Hard gate — operator sign-off required even after blocks clear.",
          },
        ],
      },
      draft: {
        channel: "email",
        status: "preview_only",
        subject: "Re: financing options for your HVAC replacement",
        previewSummary:
          "BLOCKED preview. Draft contains prohibited finance/APR language and must not be sent. Shown only so the operator can see why it was blocked.",
        body: [
          "Hi Sam,",
          "",
          "[BLOCKED DRAFT — DO NOT SEND]",
          "This draft was flagged because it referenced financing and APR terms,",
          "which are not permitted in Client Zero outreach. It is shown here for",
          "operator review only and cannot be approved in its current form.",
        ].join("\n"),
        wordCount: 41,
        generatedBy: "draft-composer (mock)",
        claimScan: {
          financeTerms: 2,
          aprTerms: 1,
          approvalOddsTerms: 0,
          guaranteeTerms: 0,
        },
      },
      appointment: {
        provider: "mock-scheduler",
        status: "none",
        proposedSlots: [],
        confirmedSlot: null,
        note: "No slots proposed while lead is blocked.",
      },
      crm: {
        provider: "mock-crm",
        status: "not_synced",
        recordId: null,
        lastSyncedAt: null,
        note: "Blocked leads are not written to CRM.",
      },
      proofLog: [
        {
          ts: "2026-06-21T09:12:00Z",
          actor: "system",
          event: "lead.ingested",
          detail: "Lead captured from sandbox referral.",
          hash: "11aa…90b2",
        },
        {
          ts: "2026-06-21T09:12:03Z",
          actor: "system",
          event: "consent.check",
          detail: "No consent on file → CONSENT_MISSING.",
          hash: "44cd…1f08",
        },
        {
          ts: "2026-06-21T09:13:30Z",
          actor: "system",
          event: "compliance.blocked",
          detail: "FINANCE_CLAIM_DETECTED + CONSENT_MISSING. Send disabled.",
          hash: "7f31…d5a6",
        },
      ],
    },
  ],
};
