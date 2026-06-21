/*
 * Client Zero — Sales Closer operator console (render + interaction).
 *
 * Pure client-side, zero dependencies, zero network calls. Reads from
 * window.CLIENT_ZERO_FIXTURES (see fixtures.js) so it can be opened directly
 * via file:// for verification. Swap the data source for the workflow-core
 * adapter described in README.md to go live.
 *
 * Human-in-the-loop is enforced in the UI: a draft can never reach an
 * "approved" decision unless an operator clicks Approve, and Approve is
 * disabled whenever compliance state is BLOCKED.
 */
(function () {
  "use strict";

  var DATA = (window.CLIENT_ZERO_FIXTURES || { leads: [] });
  var isLive = DATA.source === "workflow-core";

  // In-memory operator decisions (never persisted, never sent anywhere).
  var decisions = {}; // leadId -> { state: "approved"|"rejected", at, reason }

  var els = {
    banner: document.getElementById("mockBanner"),
    sourceMeta: document.getElementById("sourceMeta"),
    leadList: document.getElementById("leadList"),
    main: document.getElementById("main"),
  };

  var selectedId = DATA.leads.length ? DATA.leads[0].id : null;

  // --- small DOM helpers ---
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function")
        el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }
  function fmtTs(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      return d.toISOString().replace("T", " ").replace(".000Z", "Z");
    } catch (e) {
      return iso;
    }
  }

  function severityClass(sev) {
    return sev === "block" ? "block" : sev === "warn" ? "warn" : "info";
  }
  function complianceBadgeClass(state) {
    if (state === "PASS") return "pass";
    if (state === "BLOCKED") return "block";
    return "warn"; // NEEDS_REVIEW
  }

  // --- banner / header ---
  function renderChrome() {
    if (isLive) {
      els.banner.style.display = "none";
    }
    els.sourceMeta.textContent =
      "source: " + DATA.source + " · generated " + fmtTs(DATA.generatedAt);
  }

  // --- lead rail ---
  function renderRail() {
    els.leadList.innerHTML = "";
    DATA.leads.forEach(function (lead) {
      var btn = h(
        "button",
        {
          class: "lead-item" + (lead.id === selectedId ? " active" : ""),
          type: "button",
          onclick: function () {
            selectedId = lead.id;
            render();
          },
        },
        [
          h("div", { class: "li-name", text: lead.name }),
          h("div", { class: "li-co", text: lead.company }),
          h("div", {}, [
            h("span", {
              class: "badge " + complianceBadgeClass(lead.compliance.state),
              text: lead.compliance.state,
            }),
          ]),
        ]
      );
      els.leadList.appendChild(btn);
    });
  }

  // --- cards ---
  function leadDetailCard(lead) {
    var kv = h("dl", { class: "kv" }, [
      h("dt", { text: "Lead ID" }), h("dd", { text: lead.id }),
      h("dt", { text: "Name" }), h("dd", { text: lead.name }),
      h("dt", { text: "Company" }), h("dd", { text: lead.company }),
      h("dt", { text: "Role" }), h("dd", { text: lead.role }),
      h("dt", { text: "Email" }), h("dd", { text: lead.email }),
      h("dt", { text: "Phone" }), h("dd", { text: lead.phone }),
      h("dt", { text: "Timezone" }), h("dd", { text: lead.timezone }),
      h("dt", { text: "Source" }), h("dd", { text: lead.source }),
      h("dt", { text: "Stage" }), h("dd", { text: lead.stage }),
      h("dt", { text: "Intent" }), h("dd", { text: lead.intent }),
      h("dt", { text: "Consent" }),
      h("dd", {}, [
        h("span", {
          class:
            "badge " +
            (lead.consent.marketing === "granted" ? "pass" : "block"),
          text: "marketing: " + lead.consent.marketing,
        }),
        h("div", {
          class: "note",
          text:
            (lead.consent.basis || "") +
            (lead.consent.recordedAt
              ? " · recorded " + fmtTs(lead.consent.recordedAt)
              : ""),
        }),
      ]),
    ]);
    return h("section", { class: "card" }, [
      h("h3", { text: "Lead detail" }),
      kv,
    ]);
  }

  function complianceCard(lead) {
    var c = lead.compliance;
    var reasons = c.reasons.map(function (r) {
      return h("div", { class: "reason " + severityClass(r.severity) }, [
        h("span", { class: "pill", text: r.code }),
        h("div", {}, [
          h("div", { class: "r-label", text: r.label }),
          h("div", { class: "r-detail", text: r.detail }),
        ]),
      ]);
    });
    return h("section", { class: "card" }, [
      h("h3", { text: "Compliance state & reason codes" }),
      h("div", {}, [
        h("span", {
          class: "badge " + complianceBadgeClass(c.state),
          text: c.state,
        }),
      ]),
      h("p", { class: "note", text: c.summary }),
      h("div", {}, reasons),
    ]);
  }

  function draftCard(lead) {
    var d = lead.draft;
    var scan = d.claimScan || {};
    function scanItem(label, n) {
      return h("span", { class: n > 0 ? "bad" : "ok" }, [
        (n > 0 ? "✗ " : "✓ ") + label + ": " + n,
      ]);
    }
    return h("section", { class: "card" }, [
      h("h3", { text: "Draft summary preview (not sent)" }),
      h("div", { class: "draft-meta" }, [
        h("span", { class: "badge info", text: "channel: " + d.channel }),
        h("span", { class: "badge warn", text: "status: " + d.status }),
        h("span", { class: "badge info", text: d.wordCount + " words" }),
      ]),
      h("div", {}, [h("strong", { text: "Subject: " }), d.subject]),
      h("p", { class: "note", text: d.previewSummary }),
      h("pre", { class: "draft-body", text: d.body }),
      h("div", { class: "scan-row" }, [
        h("strong", { text: "Claim scan:" }),
        scanItem("finance", scan.financeTerms || 0),
        scanItem("APR", scan.aprTerms || 0),
        scanItem("approval-odds", scan.approvalOddsTerms || 0),
        scanItem("guarantee", scan.guaranteeTerms || 0),
      ]),
    ]);
  }

  function controlsCard(lead) {
    var blocked = lead.compliance.state === "BLOCKED";
    var decision = decisions[lead.id];

    var approveBtn = h("button", {
      class: "btn approve",
      type: "button",
      disabled: blocked || (decision && decision.state) ? "disabled" : null,
      onclick: function () {
        recordDecision(lead, "approved");
      },
      text: "Approve draft",
    });
    if (!(blocked || (decision && decision.state))) approveBtn.removeAttribute("disabled");

    var rejectBtn = h("button", {
      class: "btn reject",
      type: "button",
      disabled: decision && decision.state ? "disabled" : null,
      onclick: function () {
        recordDecision(lead, "rejected");
      },
      text: "Reject draft",
    });
    if (!(decision && decision.state)) rejectBtn.removeAttribute("disabled");

    var children = [
      h("h3", { text: "Human approval controls" }),
      h("div", { class: "controls" }, [approveBtn, rejectBtn]),
      h("p", {
        class: "gate-note",
        text: blocked
          ? "Approve is disabled: compliance state is BLOCKED. Resolve all block reasons before this draft can be approved."
          : "Hard gate: nothing is queued or sent until an operator approves. Approval here only marks the draft ready — sending stays out of scope for this console.",
      }),
    ];

    if (decision && decision.state) {
      children.push(
        h("div", { class: "decision-state " + decision.state }, [
          (decision.state === "approved" ? "✓ APPROVED" : "✗ REJECTED") +
            " by operator at " +
            fmtTs(decision.at),
        ])
      );
    }

    return h("section", { class: "card" }, children);
  }

  function apptCrmCard(lead) {
    var a = lead.appointment;
    var crm = lead.crm;
    var slots = (a.proposedSlots || []).map(function (s) {
      return h("div", { class: "slot", text: "• " + fmtTs(s) });
    });
    return h("section", { class: "card" }, [
      h("h3", { text: "Appointment / CRM status (mock)" }),
      h("div", { class: "status-line" }, [
        h("strong", { text: "Appointment:" }),
        h("span", {
          class:
            "badge " +
            (a.status === "confirmed" ? "pass" : a.status === "none" ? "block" : "warn"),
          text: a.status,
        }),
        h("span", { class: "note", text: a.provider }),
      ]),
      slots.length ? h("div", {}, slots) : h("div", { class: "note", text: "No slots proposed." }),
      h("p", { class: "note", text: a.note }),
      h("div", { class: "status-line" }, [
        h("strong", { text: "CRM:" }),
        h("span", {
          class:
            "badge " +
            (crm.status === "synced_dry_run" ? "pass" : crm.status === "not_synced" ? "block" : "warn"),
          text: crm.status,
        }),
        h("span", { class: "note", text: crm.recordId || "no record" }),
      ]),
      h("p", { class: "note", text: crm.note }),
    ]);
  }

  function proofCard(lead) {
    var rows = lead.proofLog.map(function (e) {
      return h("div", { class: "proof-row" }, [
        h("span", { class: "ts", text: fmtTs(e.ts) }),
        h("span", { class: "actor-" + e.actor, text: e.actor }),
        h("span", {}, [h("strong", { text: e.event + " " }), e.detail]),
        h("span", { class: "hash", text: e.hash || "" }),
      ]);
    });
    return h("section", { class: "card proof" }, [
      h("h3", { text: "Proof log (append-only)" }),
      h("div", {}, rows),
    ]);
  }

  // --- operator decision (local only) ---
  function recordDecision(lead, state) {
    if (state === "approved" && lead.compliance.state === "BLOCKED") return; // hard gate
    var at = new Date().toISOString();
    decisions[lead.id] = { state: state, at: at };
    // Append to the in-memory proof log so the operator sees their own action.
    lead.proofLog.push({
      ts: at,
      actor: "operator",
      event: "decision." + state,
      detail:
        "Operator " +
        (state === "approved" ? "approved" : "rejected") +
        " draft (sandbox; no send performed).",
      hash: "local-" + Math.random().toString(16).slice(2, 6),
    });
    render();
  }

  // --- main render ---
  function renderMain() {
    els.main.innerHTML = "";
    var lead = DATA.leads.filter(function (l) {
      return l.id === selectedId;
    })[0];
    if (!lead) {
      els.main.appendChild(h("p", { text: "No lead selected." }));
      return;
    }
    els.main.appendChild(
      h("div", { class: "grid-2" }, [leadDetailCard(lead), complianceCard(lead)])
    );
    els.main.appendChild(draftCard(lead));
    els.main.appendChild(
      h("div", { class: "grid-2" }, [controlsCard(lead), apptCrmCard(lead)])
    );
    els.main.appendChild(proofCard(lead));
  }

  function render() {
    renderRail();
    renderMain();
  }

  // expose a tiny API for tests / future adapter swap
  window.OperatorConsole = {
    render: render,
    _recordDecision: recordDecision,
    _decisions: decisions,
    _data: DATA,
  };

  renderChrome();
  render();
})();
