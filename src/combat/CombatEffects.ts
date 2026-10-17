import Phaser from 'phaser';
import type { CombatController } from './CombatController';

export class CombatEffects {
  private readonly projectiles: Phaser.GameObjects.Graphics;
  private readonly range: Phaser.GameObjects.Graphics;
  private readonly damageLabels: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.projectiles = scene.add.graphics().setDepth(12);
    this.range = scene.add.graphics().setDepth(3);
  }

  update(combat: CombatController, aiming: boolean): void {
    this.range.clear();
    if (aiming) {
      const radius = combat.config.attackRange + combat.motion.config.collisionRadius;
      this.range.fillStyle(0x8fdfd0, 0.035).fillCircle(combat.motion.x, combat.motion.y, radius);
      this.range.lineStyle(2, 0x8fdfd0, 0.75).strokeCircle(combat.motion.x, combat.motion.y, radius);
    }
    const g = this.projectiles;
    g.clear();
    for (const p of combat.projectiles) {
      const target = combat.targets.find(t => t.id === p.target.id);
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : 0;
      g.lineStyle(6, 0x86e0d3, 0.2).lineBetween(p.x - Math.cos(angle) * 27, p.y - Math.sin(angle) * 27, p.x, p.y);
      g.lineStyle(2.5, 0xeff3c0, 0.95).lineBetween(p.x - Math.cos(angle) * 18, p.y - Math.sin(angle) * 18, p.x, p.y);
      g.fillStyle(0xffe5a0).fillCircle(p.x, p.y, 4);
    }
    while (this.damageLabels.length < combat.hits.length) {
      this.damageLabels.push(this.scene.add.text(0, 0, '', { fontFamily: 'Consolas, monospace', fontSize: '26px', fontStyle: 'bold', color: '#ffe1a1', stroke: '#24342c', strokeThickness: 3 }).setOrigin(0.5).setDepth(15));
    }
    this.damageLabels.forEach((label, i) => {
      const hit = combat.hits[i];
      label.setVisible(!!hit);
      if (hit) label.setPosition(hit.x, hit.y - hit.age * 58).setAlpha(1 - hit.age / 0.7).setText(`−${Math.round(hit.damage)}`);
    });
  }
}
