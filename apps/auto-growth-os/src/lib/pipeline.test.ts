import { describe, expect, it } from 'vitest';
import { canMarkSold, canTransition, nextStage } from './pipeline';

describe('nextStage', () => {
  it('advances one stage along the pipeline order', () => {
    expect(nextStage('Nurture')).toBe('Qualified');
    expect(nextStage('Qualified')).toBe('Hot Lead');
    expect(nextStage('Hot Lead')).toBe('Immediate Sales Handoff');
  });

  it('clamps at the final stage', () => {
    expect(nextStage('Immediate Sales Handoff')).toBe('Immediate Sales Handoff');
  });
});

describe('canTransition', () => {
  it('allows a manual move to any other valid stage', () => {
    expect(canTransition('Nurture', 'Hot Lead')).toBe(true);
    expect(canTransition('Immediate Sales Handoff', 'Nurture')).toBe(true);
  });

  it('rejects a no-op transition to the same stage', () => {
    expect(canTransition('Qualified', 'Qualified')).toBe(false);
  });
});

describe('canMarkSold', () => {
  it('blocks marking an already-sold vehicle', () => {
    expect(canMarkSold({ availabilityStatus: 'sold' })).toBe(false);
  });

  it('allows marking available / reserved / unset vehicles sold', () => {
    expect(canMarkSold({ availabilityStatus: 'available' })).toBe(true);
    expect(canMarkSold({ availabilityStatus: 'reserved' })).toBe(true);
    expect(canMarkSold({})).toBe(true);
  });
});
