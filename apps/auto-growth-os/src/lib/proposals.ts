// lib/proposals.ts
// Pure helpers that turn discovery answers into a saved session, a Proposal, and
// a Demandara GTM prospect. Deterministic with injected id/now.
import type { DiscoveryAnswers, DiscoverySession, GTMProspect, Proposal } from '../types';
import {
  generateDiscoveryOutput,
  recommendDiscoveryPackage,
  scoreDiscovery,
  type DiscoveryOutput,
} from './discovery';

function dealershipName(a: DiscoveryAnswers): string {
  return typeof a.dealership === 'string' && a.dealership.trim()
    ? a.dealership
    : 'Unnamed dealership';
}

function cityName(a: DiscoveryAnswers): string {
  return typeof a.city === 'string' && a.city.trim() ? a.city : '—';
}

export function proposalMarkdown(o: DiscoveryOutput): string {
  const L = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  return [
    `# Auto Growth OS Proposal`,
    ``,
    `**Recommended package:** ${o.recommendedPackage}`,
    `**Investment:** ${o.pricingRange}`,
    ``,
    `## Client understanding`,
    o.clientUnderstanding,
    ``,
    `## What we heard`,
    L(o.whatWeHeard),
    ``,
    `## Proposed system`,
    L(o.proposedSystem),
    ``,
    `## 30/60/90 roadmap`,
    `**30:** ${o.roadmap.d30.join('; ')}`,
    `**60:** ${o.roadmap.d60.join('; ')}`,
    `**90:** ${o.roadmap.d90.join('; ')}`,
    ``,
    `## Responsibilities`,
    `**Client:** ${o.clientResponsibilities.join('; ')}`,
    `**Demandara:** ${o.demandaraResponsibilities.join('; ')}`,
    `**Cognitia:** ${o.cognitiaResponsibilities.join('; ')}`,
    ``,
    `## Risk notes`,
    L(o.riskNotes),
    ``,
    o.finalConfirmation,
  ].join('\n');
}

export function discoverySessionFromAnswers(
  answers: DiscoveryAnswers,
  id: string,
  now: string,
): DiscoverySession {
  const scores = scoreDiscovery(answers);
  return {
    id,
    dealership: dealershipName(answers),
    answers,
    scores,
    recommendedPackage: recommendDiscoveryPackage(scores, answers),
    createdAt: now,
  };
}

export function proposalFromDiscovery(
  answers: DiscoveryAnswers,
  sessionId: string,
  id: string,
  now: string,
): Proposal {
  const output = generateDiscoveryOutput(answers);
  return {
    id,
    sessionId,
    dealership: dealershipName(answers),
    recommendedPackage: output.recommendedPackage,
    pricingRange: output.pricingRange,
    markdown: proposalMarkdown(output),
    createdAt: now,
  };
}

export function gtmProspectFromDiscovery(
  answers: DiscoveryAnswers,
  id: string,
  now: string,
): GTMProspect {
  const scores = scoreDiscovery(answers);
  const pkg = recommendDiscoveryPackage(scores, answers);
  const signalScore = Math.max(
    1,
    Math.min(
      100,
      Math.round(scores.complexity + scores.automation / 2 + scores.infrastructureReadiness / 5),
    ),
  );
  return {
    id,
    dealership: dealershipName(answers),
    city: cityName(answers),
    contactName: 'From discovery session',
    signalScore,
    stage: 'qualified',
    notes: 'Created from a completed discovery session.',
    recommendedPackage: pkg,
    nextStep: 'Review proposal & book a growth review',
    createdAt: now,
  };
}
