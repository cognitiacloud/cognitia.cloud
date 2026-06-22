// lib/recommendation.ts
// Pure, explainable package recommendation engine.
//
//   Pilot  → website / intake / CRM and a lower budget.
//   Growth → ads, GTM, appointment setting, monthly lead generation.
//   Empire → Customer Mapper, WhatsApp automation, AI agents, mobile-app roadmap.

import type {
  AdBudgetBand,
  BudgetBand,
  IntakeAnswers,
  LeadSource,
  Package,
  PackageRecommendation,
  PackageTier,
  ResponseTarget,
  RetentionMaturity,
} from '../types';
import packagesRaw from '../data/packages.json';

const PACKAGES = packagesRaw as Package[];

const MVP_BUDGET_SCORE: Record<BudgetBand, number> = {
  Starter: 1,
  Growth: 2,
  Premium: 3,
  Enterprise: 4,
};

const AD_BUDGET_SCORE: Record<AdBudgetBand, number> = {
  'Under $1k': 0,
  '$1k–$3k': 1,
  '$3k–$7k': 2,
  '$7k+': 3,
};

const FAST_TARGETS: ResponseTarget[] = ['Under 5 minutes', 'Under 30 minutes'];
const PAID_SOURCES: LeadSource[] = ['Google Ads', 'Meta Ads'];

function packageFor(tier: PackageTier): Package {
  const pkg = PACKAGES.find((p) => p.tier === tier);
  if (!pkg) throw new Error(`Missing package seed for tier "${tier}"`);
  return pkg;
}

/**
 * Deterministic, transparent scoring. We accumulate "ambition points" and a
 * running rationale so the UI can explain *why* a tier was recommended.
 */
export function recommendPackage(answers: IntakeAnswers): PackageRecommendation {
  const rationale: string[] = [];
  let points = 0;

  // 1. MVP budget is the strongest single signal (weighted x2).
  const mvpScore = MVP_BUDGET_SCORE[answers.mvpBudget] ?? 1;
  points += mvpScore * 2;
  rationale.push(`MVP budget tier "${answers.mvpBudget}" sets the baseline investment level.`);

  // 2. Monthly ad budget signals readiness for paid acquisition.
  const adScore = AD_BUDGET_SCORE[answers.monthlyAdBudget] ?? 0;
  points += adScore;
  if (adScore >= 2) {
    rationale.push(
      `Monthly ad budget of ${answers.monthlyAdBudget} supports Paid Media Operations and GTM prospecting.`,
    );
  }

  // 3. Already running paid channels → ready for ads ops today.
  const usesPaid = answers.topLeadSources.some((s) => PAID_SOURCES.includes(s));
  if (usesPaid) {
    points += 1;
    rationale.push(
      'You already run paid channels, so paid media management pays for itself quickly.',
    );
  }

  // 4. Aggressive response targets imply automation (AI + WhatsApp).
  const wantsFast = FAST_TARGETS.includes(answers.responseTarget);
  if (wantsFast) {
    points += 1;
    rationale.push(
      `A ${answers.responseTarget.toLowerCase()} response target needs AI drafting and WhatsApp automation to hit consistently.`,
    );
  }

  // 5. Retention gaps unlock the Customer Mapper value.
  const retentionGap: RetentionMaturity = answers.retentionMaturity;
  const hasRetentionGap = retentionGap === 'No structured retention';
  if (hasRetentionGap) {
    points += 1;
    rationale.push(
      'No structured retention today — the Customer Mapper recaptures service and repurchase revenue.',
    );
  }

  const wantsAutomation = wantsFast || hasRetentionGap;

  // Decision boundaries.
  let tier: PackageTier;
  if (points >= 7 && wantsAutomation) {
    tier = 'Empire';
    rationale.push(
      'Recommendation: Empire — full customer memory, WhatsApp automation, AI agents, and a mobile-app roadmap.',
    );
  } else if (points >= 4 || usesPaid) {
    tier = 'Growth';
    rationale.push(
      'Recommendation: Growth — paid media, GTM prospecting, appointment setting, and monthly lead generation.',
    );
  } else {
    tier = 'Pilot';
    rationale.push(
      'Recommendation: Pilot — a fast website, client intake, and CRM foundation you can scale from.',
    );
  }

  const pkg = packageFor(tier);

  return {
    tier,
    package: pkg,
    rationale,
    setupCad: pkg.setupCad,
    monthlyCad: pkg.monthlyCad,
    includedModules: pkg.includedModules,
    passThroughCosts: pkg.passThroughCosts,
    launchTimeline: pkg.launchTimeline,
    fitScore: Math.min(10, points),
  };
}
