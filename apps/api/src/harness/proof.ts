/**
 * Proof evaluation for verified_fact claims.
 *
 * Strength is *derived* from evidence, never asserted by the claimant. The
 * rules below encode the harness's bar for a "strong" proof:
 *
 *   1. There must be a verifiable artifact reference (hash/receipt/URL stub).
 *   2. At least two *independent* (externally checkable) signals must be present.
 *   3. The weighted strength of present signals must clear the threshold.
 *
 * A claim that fails any of these is "weak" and the owner-verify path refuses
 * to release escrow on it.
 */
import type {
  ProofEvaluation,
  VerifiedFactProof,
} from "./types.ts";

export const STRENGTH_THRESHOLD = 0.6;
export const MIN_INDEPENDENT_SIGNALS = 2;

export function evaluateProof(proof: VerifiedFactProof): ProofEvaluation {
  const reasons: string[] = [];

  const presentSignals = proof.evidence.filter((e) => e.present);
  const independentSignals = presentSignals.filter((e) => e.independent).length;

  const totalWeight = proof.evidence.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  const presentWeight = presentSignals.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  const strength = totalWeight === 0 ? 0 : clamp01(presentWeight / totalWeight);

  let verdict: ProofEvaluation["verdict"] = "strong";

  if (proof.artifactRef === null || proof.artifactRef.trim() === "") {
    verdict = "weak";
    reasons.push("no verifiable artifact reference");
  }
  if (independentSignals < MIN_INDEPENDENT_SIGNALS) {
    verdict = "weak";
    reasons.push(
      `only ${independentSignals} independent signal(s); need ${MIN_INDEPENDENT_SIGNALS}`,
    );
  }
  if (strength < STRENGTH_THRESHOLD) {
    verdict = "weak";
    reasons.push(
      `strength ${strength.toFixed(2)} below threshold ${STRENGTH_THRESHOLD.toFixed(2)}`,
    );
  }

  if (verdict === "strong") {
    reasons.push("artifact present, independent signals met, strength above threshold");
  }

  return {
    verdict,
    strength,
    independentSignals,
    reasons,
  };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
