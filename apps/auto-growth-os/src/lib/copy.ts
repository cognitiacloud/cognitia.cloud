// lib/copy.ts
// Centralized product naming + required safety disclaimers. Reused everywhere so
// wording stays consistent and compliant. Never introduce guarantee language.

export const PRODUCT = {
  name: 'Demandara Dealership Growth OS',
  short: 'Auto Growth OS',
  poweredBy: 'powered by Cognitia',
  demandara: 'Demandara',
  cognitia: 'Cognitia',
  dealer: 'BudgetWheels',
};

export const DISCLAIMERS = {
  confirmDetails:
    'Availability, pricing, financing, warranty, and trade-in details should be confirmed with the dealership.',
  noGuarantees:
    'This system improves operating infrastructure and measurement. It does not guarantee sales, leads, ROI, rankings, or financing approvals.',
  humanApproval: 'AI-assisted drafts require human approval for sensitive claims.',
  formSuccess: 'Thanks — your request was captured. A team member can confirm details directly.',
  demo: 'Demo environment · Integrations simulated · No real customer data.',
  adSpend: 'Client owns ad accounts and pays ad spend directly.',
} as const;
