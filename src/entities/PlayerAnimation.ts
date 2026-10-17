import type { BasicAttack } from '../combat/BasicAttack';
import { PLAYER_VISUAL_CONFIG } from '../config/playerVisuals';
import type { PlayerFrameName } from '../config/playerVisuals';

/** 美术状态只读取模拟结果；移动可立即切回跑步，不影响攻击冷却。 */
export class PlayerAnimation {
  private runElapsed = 0;

  constructor(private readonly moveSpeed: number) {}

  update(dt: number, speed: number, attack: Pick<BasicAttack, 'state' | 'recoveryCancelled'>): PlayerFrameName {
    if (attack.state === 'Windup' || (attack.state === 'AttackReleased' && !attack.recoveryCancelled)) {
      this.runElapsed = 0;
      return 'windup';
    }
    if (speed <= 1) {
      this.runElapsed = 0;
      return 'idle';
    }
    this.runElapsed += Math.max(0, dt) * Math.min(1, speed / this.moveSpeed);
    const { runSequence, runFrameSeconds } = PLAYER_VISUAL_CONFIG;
    const index = Math.floor((this.runElapsed + 1e-9) / runFrameSeconds) % runSequence.length;
    return runSequence[index];
  }
}
