import Phaser from 'phaser';
import { TARGET_LAYOUT } from '../combat/TargetSelection';
import type { Minion } from './Minion';
import { MINION_VISUALS } from '../config/minionVisuals';

export class MinionView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly sprite?: Phaser.GameObjects.Image;
  private facingLeft: boolean;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, readonly model: Minion, private readonly deathSeconds: number) {
    this.ground = scene.add.graphics();
    this.body = scene.add.graphics();
    this.facingLeft = model.team === 'red';
    const children: Phaser.GameObjects.GameObject[] = [this.ground];
    if (model.kind !== 'cannon') {
      const visual = MINION_VISUALS[model.team][model.kind];
      scene.textures.get(visual.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.sprite = scene.add.image(0, 14, visual.key).setOrigin(visual.anchor.x, visual.anchor.y)
        .setScale(visual.height / visual.sourceHeight);
      children.push(this.sprite);
    }
    children.push(this.body);
    // 独立世界层级：所有血条都在角色、技能、伤害数字和单位名称上方。
    this.bars = scene.add.graphics().setDepth(41);
    this.label = scene.add.text(0, TARGET_LAYOUT.labelY, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#c8d2bf', align: 'center' }).setOrigin(0.5, 0).setDepth(40);
    this.container = scene.add.container(model.x, model.y, children).setDepth(8);
  }

  update(selected: boolean, hovered: boolean, playerDamage: number): void {
    const m = this.model;
    const friendly = m.team === 'blue';
    const lastHittable = !friendly && m.alive && m.health <= playerDamage * 100 / (100 + m.stats.armor);
    const alpha = m.alive ? 1 : Math.max(0, 1 - m.deathAge / this.deathSeconds);
    this.container.setPosition(m.x, m.y).setAlpha(alpha);
    this.bars.setPosition(m.x, m.y).setAlpha(alpha);
    this.label.setAlpha(alpha);
    this.body.rotation = this.sprite ? 0 : m.motion.heading + Math.PI / 2;
    if (this.sprite && m.kind !== 'cannon') {
      const visual = MINION_VISUALS[m.team][m.kind];
      const horizontal = Math.cos(m.motion.heading);
      if (Math.abs(horizontal) > 0.15) this.facingLeft = horizontal < 0;
      this.sprite.setFlipX(this.facingLeft)
        .setOrigin(this.facingLeft ? 1 - visual.anchor.x : visual.anchor.x, visual.anchor.y);
      const moving = m.alive && Math.hypot(m.motion.velocity.x, m.motion.velocity.y) > 1;
      const bob = moving ? Math.sin(m.attack.now * 9 + m.formationIndex * 0.7) * 0.7 : 0;
      const lean = m.alive && m.attack.state === 'Windup' ? m.attack.windupProgress * 1.5 : 0;
      this.sprite.setPosition((this.facingLeft ? -1 : 1) * lean, 14 + bob);
    }
    this.ground.clear(); this.body.clear(); this.bars.clear();
    const g = this.ground;
    const body = this.body;
    g.fillStyle(0x10231e, 0.55).fillEllipse(3, 11, m.kind === 'cannon' ? 54 : 39, 21);
    if (selected || hovered) g.lineStyle(selected ? 3 : 2, friendly ? 0x95d8e4 : selected ? 0xf4a07c : 0xffd999, 0.95).strokeEllipse(0, 4, 53, 31);
    const color = friendly ? 0x4f94b5 : 0xb55b58;
    if (m.kind === 'cannon') {
      body.fillStyle(0x243a37).fillCircle(-20, 8, 8).fillCircle(20, 8, 8);
      body.fillStyle(color).fillRoundedRect(-21, -14, 42, 30, 5);
      body.fillStyle(0xd0b783).fillRect(-5, -29, 10, 23);
      body.lineStyle(2, 0xf0d49b).lineBetween(-4, -28, 4, -28);
    }
    if (m.attack.state === 'Windup' && m.alive) g.lineStyle(2, friendly ? 0x9bd8ec : 0xffbb91, 0.55).beginPath().arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + m.attack.windupProgress * Math.PI * 2).strokePath();
    if (m.hitFlash > 0) body.fillStyle(0xffefc8, m.hitFlash / 0.14 * 0.65).fillCircle(0, 0, 21);
    const bar = TARGET_LAYOUT.healthBar;
    this.bars.fillStyle(0x071a17, 0.95).fillRect(bar.x, bar.y, bar.width, bar.height);
    this.bars.fillStyle(lastHittable ? 0xf0ce71 : friendly ? 0x71c5e2 : 0xd87a69)
      .fillRect(bar.x + 2, bar.y + 2, (bar.width - 4) * Math.max(0, m.health) / m.stats.maxHealth, bar.height - 4);
    this.bars.lineStyle(hovered ? 2 : 1, lastHittable ? 0xf8d980 : hovered ? 0xf6d79c : 0xafba98, hovered || lastHittable ? 0.9 : 0.4)
      .strokeRect(bar.x, bar.y, bar.width, bar.height);
    if (lastHittable) this.bars.fillStyle(0xf0ce71).fillTriangle(-4, -49, 4, -49, 0, -44);
    if (!m.alive) {
      const cs = m.team === 'red' && m.deathSource?.kind === 'player';
      this.label.setText(cs ? '+1 CS' : m.team === 'red' ? '漏刀' : '').setColor(cs ? '#ffe18a' : '#ce9d89')
        .setPosition(m.x, m.y + TARGET_LAYOUT.labelY - m.deathAge * 40);
    } else {
      const name = selected || hovered ? m.name : { melee: '近战', ranged: '远程', cannon: '炮车' }[m.kind];
      this.label.setText(`${name}\n${Math.ceil(m.health)}`).setColor(lastHittable ? '#ffe18a' : friendly ? '#9bc6d3' : hovered ? '#ffe0ac' : '#d1b7a7').setPosition(m.x, m.y + TARGET_LAYOUT.labelY);
    }
  }

  destroy(): void { this.container.destroy(true); this.bars.destroy(); this.label.destroy(); }
}
