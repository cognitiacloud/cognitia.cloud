// lib/scoring.test.ts
// Run with: npm test  (vitest)

import { describe, expect, it } from 'vitest';
import { scoreLead, stageForScore, scoreAndStage } from './scoring';
import type { ScoringSignals } from '../types';

const none: ScoringSignals = {
  appointmentRequested: false,
  financingRequested: false,
  tradeInMentioned: false,
  budgetProvided: false,
  respondToday: false,
  specificVehicleSelected: false,
};

const sig = (over: Partial<ScoringSignals>): ScoringSignals => ({ ...none, ...over });

describe('scoreLead', () => {
  it('scores zero when nothing is set', () => {
    expect(scoreLead(none)).toBe(0);
  });

  it('applies the exact documented weights', () => {
    expect(scoreLead(sig({ appointmentRequested: true }))).toBe(25);
    expect(scoreLead(sig({ financingRequested: true }))).toBe(20);
    expect(scoreLead(sig({ tradeInMentioned: true }))).toBe(20);
    expect(scoreLead(sig({ budgetProvided: true }))).toBe(15);
    expect(scoreLead(sig({ respondToday: true }))).toBe(10);
    expect(scoreLead(sig({ specificVehicleSelected: true }))).toBe(10);
  });

  it('sums multiple signals', () => {
    expect(scoreLead(sig({ appointmentRequested: true, financingRequested: true }))).toBe(45);
  });

  it('caps at 100 when every signal fires', () => {
    const all = sig({
      appointmentRequested: true,
      financingRequested: true,
      tradeInMentioned: true,
      budgetProvided: true,
      respondToday: true,
      specificVehicleSelected: true,
    });
    // 25+20+20+15+10+10 = 100
    expect(scoreLead(all)).toBe(100);
  });
});

describe('stageForScore', () => {
  it('maps the documented bands', () => {
    expect(stageForScore(0)).toBe('Nurture');
    expect(stageForScore(30)).toBe('Nurture');
    expect(stageForScore(31)).toBe('Qualified');
    expect(stageForScore(60)).toBe('Qualified');
    expect(stageForScore(61)).toBe('Hot Lead');
    expect(stageForScore(85)).toBe('Hot Lead');
    expect(stageForScore(86)).toBe('Immediate Sales Handoff');
    expect(stageForScore(100)).toBe('Immediate Sales Handoff');
  });
});

describe('scoreAndStage', () => {
  it('combines score and stage', () => {
    const result = scoreAndStage(
      sig({ appointmentRequested: true, financingRequested: true, tradeInMentioned: true }),
    );
    // 25+20+20 = 65 → Hot Lead
    expect(result).toEqual({ score: 65, stage: 'Hot Lead' });
  });
});
