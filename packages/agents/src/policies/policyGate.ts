import {
  classifyRisk,
  decideApproval,
  type ActionType,
  type RiskLevel,
  type TenantApprovalSettings,
} from '@cognitia/core';

export interface PolicyDecision {
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  blocked: boolean;
  reason: string;
}

/**
 * Classifies action risk and decides approval using tenant settings and
 * suppression/consent. Human approval is the default for outbound send, calling,
 * CRM mutation, and ads launch. Suppressed targets are blocked.
 */
export class PolicyGate {
  constructor(private readonly settings: TenantApprovalSettings = {}) {}

  evaluate(input: { actionType: ActionType; isSuppressed: boolean }): PolicyDecision {
    const riskLevel = classifyRisk(input.actionType);
    const decision = decideApproval({
      actionType: input.actionType,
      riskLevel,
      isSuppressed: input.isSuppressed,
      settings: this.settings,
    });
    return {
      riskLevel,
      requiresApproval: decision.requiresApproval,
      blocked: decision.blocked,
      reason: decision.reason,
    };
  }
}
