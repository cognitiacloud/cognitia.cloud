// lib/pipeline.ts
// Pure pipeline-stage + inventory guards. The CRM allows manual moves to any
// valid stage; `nextStage` advances one step for the "advance" control.
import type { Stage, Vehicle } from '../types';
import { STAGE_ORDER } from './constants';

export function nextStage(stage: Stage): Stage {
  const i = STAGE_ORDER.indexOf(stage);
  if (i < 0) return STAGE_ORDER[0] as Stage;
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)] as Stage;
}

export function canTransition(from: Stage, to: Stage): boolean {
  return from !== to && STAGE_ORDER.includes(to);
}

/** A vehicle can be marked sold unless it is already sold. */
export function canMarkSold(v: Pick<Vehicle, 'availabilityStatus'>): boolean {
  return v.availabilityStatus !== 'sold';
}
