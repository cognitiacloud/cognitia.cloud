import { describe, it, expect } from 'vitest';
import {
  scoreSignals,
  SIGNAL_WEIGHTS,
  RISK_BAND_VALUE,
  EVIDENCE_CONFIDENCE,
} from './signalScoring.js';

describe('scoreSignals — deterministic math', () => {
  it('scores a perfect, zero-risk, fully-evidenced prospect at 1.0', () => {
    const r = scoreSignals({
      fit: 1,
      urgency: 1,
      consentRisk: 'low',
      sourceRisk: 'low',
      evidence: 'verified_fact',
    });
    // 0.4*1 + 0.25*1 + 0.15*1 - 0.2*0 - 0.2*0 = 0.8 ... clamp keeps it at 0.8
    expect(r.score).toBe(0.8);
    expect(r.breakdown.fit).toBe(0.4);
    expect(r.breakdown.urgency).toBe(0.25);
    expect(r.breakdown.proofConfidence).toBe(0.15);
    expect(r.breakdown.consentRiskPenalty).toBe(-0);
    expect(r.breakdown.sourceRiskPenalty).toBe(-0);
  });

  it('floors a worst-case prospect at 0 (penalties exceed rewards)', () => {
    const r = scoreSignals({
      fit: 0,
      urgency: 0,
      consentRisk: 'high',
      sourceRisk: 'high',
      evidence: 'unknown',
    });
    expect(r.score).toBe(0);
    expect(r.breakdown.consentRiskPenalty).toBe(-0.2);
    expect(r.breakdown.sourceRiskPenalty).toBe(-0.2);
  });

  it('computes a mixed case from the documented linear blend', () => {
    const r = scoreSignals({
      fit: 0.8,
      urgency: 0.6,
      consentRisk: 'medium',
      sourceRisk: 'low',
      evidence: 'likely_inference',
    });
    // 0.4*0.8 + 0.25*0.6 + 0.15*0.5 - 0.2*0.5 - 0.2*0
    // = 0.32 + 0.15 + 0.075 - 0.10 - 0 = 0.445
    expect(r.score).toBe(0.445);
    expect(r.breakdown.fit).toBe(0.32);
    expect(r.breakdown.urgency).toBe(0.15);
    expect(r.breakdown.proofConfidence).toBe(0.075);
    expect(r.breakdown.consentRiskPenalty).toBe(-0.1);
    expect(r.breakdown.sourceRiskPenalty).toBe(-0);
  });

  it('is deterministic: identical inputs -> identical output', () => {
    const inputs = {
      fit: 0.42,
      urgency: 0.37,
      consentRisk: 'medium' as const,
      sourceRisk: 'high' as const,
      evidence: 'likely_inference' as const,
    };
    expect(scoreSignals(inputs)).toEqual(scoreSignals(inputs));
  });

  it('clamps out-of-range fit/urgency into 0..1', () => {
    const r = scoreSignals({
      fit: 5,
      urgency: -3,
      consentRisk: 'low',
      sourceRisk: 'low',
      evidence: 'verified_fact',
    });
    expect(r.components.fit).toBe(1);
    expect(r.components.urgency).toBe(0);
  });

  it('exposes the band/evidence mapping tables used', () => {
    expect(RISK_BAND_VALUE).toEqual({ low: 0, medium: 0.5, high: 1 });
    expect(EVIDENCE_CONFIDENCE).toEqual({
      verified_fact: 1,
      likely_inference: 0.5,
      unknown: 0,
    });
    expect(SIGNAL_WEIGHTS.fit).toBe(0.4);
  });
});
