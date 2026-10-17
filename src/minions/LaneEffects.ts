import Phaser from 'phaser';
import type { LaneSystem } from './LaneSystem';

export class LaneEffects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) { this.graphics = scene.add.graphics().setDepth(11); }

  update(lane: LaneSystem): void {
    const g = this.graphics;
    g.clear();
    for (const p of lane.projectiles) {
      const target = lane.minions.find(m => m.id === p.targetId);
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : 0;
      const color = p.team === 'blue' ? 0x8cdbf3 : 0xf39b86;
      g.lineStyle(3, color, 0.4).lineBetween(p.x - Math.cos(angle) * 17, p.y - Math.sin(angle) * 17, p.x, p.y);
      g.fillStyle(color).fillCircle(p.x, p.y, 3.5);
    }
    for (const effect of lane.meleeEffects) {
      g.lineStyle(3, effect.team === 'blue' ? 0xa2dcf1 : 0xffbf9c, (1 - effect.age / 0.18) * 0.8)
        .lineBetween(effect.x, effect.y, effect.toX, effect.toY);
    }
  }
}
