import Phaser from 'phaser';
import type { SkillshotKind } from '../config/skillshots';
import type { SkillshotSystem } from './SkillshotSystem';
import { SKILLSHOT_VISUALS } from '../config/skillshotVisuals';

const colors: Record<SkillshotKind, number> = { piercing: 0xdf83ef, spear: 0xff653f, energy: 0x55cfff };

/** 素材弹头对齐模拟位置；图片尾迹仅作表现，不改变连续扫掠判定。 */
export class SkillshotEffects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(17);
    for (const visual of Object.values(SKILLSHOT_VISUALS)) {
      const texture = scene.textures.get(visual.key);
      const { x, y, width, height } = visual.frame;
      texture.add('projectile', 0, x, y, width, height);
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  update(system: SkillshotSystem): void {
    const g = this.graphics;
    g.clear();
    const activeIds = new Set(system.projectiles.map(p => p.id));
    for (const [id, sprite] of this.sprites) {
      if (!activeIds.has(id)) { sprite.destroy(); this.sprites.delete(id); }
    }
    for (const p of system.projectiles) {
      const visual = SKILLSHOT_VISUALS[p.kind];
      let sprite = this.sprites.get(p.id);
      if (!sprite) {
        sprite = this.scene.add.image(p.x, p.y, visual.key, 'projectile')
          .setOrigin(visual.head.x, visual.head.y).setDepth(16)
          .setScale(visual.length / visual.frame.width);
        this.sprites.set(p.id, sprite);
      }
      sprite.setPosition(p.x, p.y).setRotation(Math.atan2(p.direction.y, p.direction.x) + visual.rotationOffset);
    }
    for (const impact of system.impacts) {
      const alpha = 1 - impact.age / system.config.feedbackSeconds;
      g.lineStyle(impact.player ? 4 : 2, impact.protected ? 0xa2e9de : colors[impact.kind], alpha * 0.8)
        .strokeCircle(impact.x, impact.y, 10 + impact.age * 48);
    }
    const playerHits = system.impacts.filter(impact => impact.player);
    while (this.labels.length < playerHits.length) {
      this.labels.push(this.scene.add.text(0, 0, '', { fontFamily: 'Consolas, Microsoft YaHei, monospace', fontSize: '24px',
        fontStyle: 'bold', color: '#ffaea5', stroke: '#202a26', strokeThickness: 4 }).setOrigin(0.5).setDepth(20));
    }
    this.labels.forEach((label, i) => {
      const hit = playerHits[i];
      label.setVisible(!!hit);
      if (hit) label.setPosition(hit.x, hit.y - 36 - hit.age * 65).setAlpha(1 - hit.age / system.config.feedbackSeconds)
        .setColor(hit.protected ? '#ace8df' : '#ffaea5').setText(hit.protected ? '免伤' : `−${Math.round(hit.damage)}`);
    });
  }
}
