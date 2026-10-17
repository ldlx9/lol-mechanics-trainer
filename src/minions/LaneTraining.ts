import { CombatController } from '../combat/CombatController';
import type { CombatConfig } from '../combat/CombatController';
import type { LaneConfig } from '../config/minions';
import type { Movement } from '../simulation/Movement';
import { LaneSystem } from './LaneSystem';

/** 波次、AI、玩家、弹道统一按固定上限的小步推进，保持帧率无关。 */
export class LaneTraining {
  readonly lane: LaneSystem;
  readonly combat: CombatController;
  private pendingSeconds = 0;

  constructor(readonly motion: Movement, laneConfig: LaneConfig, combatConfig: CombatConfig, private readonly maxStep = 1 / 120) {
    this.lane = new LaneSystem(laneConfig, motion.bounds);
    this.combat = new CombatController(motion, this.lane.minions, combatConfig, maxStep);
  }

  update(deltaSeconds: number, afterStep?: (dt: number) => void): void {
    this.pendingSeconds += deltaSeconds;
    while (this.pendingSeconds + 1e-9 >= this.maxStep) {
      const dt = this.maxStep;
      this.lane.step(dt);
      this.combat.step(dt, false);
      afterStep?.(dt);
      this.pendingSeconds = Math.max(0, this.pendingSeconds - dt);
    }
  }

  setMinionsEnabled(enabled: boolean): void {
    if (this.lane.enabled === enabled) return;
    this.lane.setEnabled(enabled);
    if (!enabled) this.combat.onTargetsRemoved();
  }
}
