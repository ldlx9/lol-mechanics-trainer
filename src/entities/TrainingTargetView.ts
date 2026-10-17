import Phaser from 'phaser';
import type { TrainingTarget } from '../combat/TrainingTarget';
import { TARGET_LAYOUT } from '../combat/TargetSelection';

export class TrainingTargetView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, readonly model: TrainingTarget, private readonly index: number) {
    this.graphics = scene.add.graphics();
    this.label = scene.add.text(0, TARGET_LAYOUT.labelY, '', { fontFamily: 'sans-serif', fontSize: `${TARGET_LAYOUT.labelFontSize}px`, color: '#e4c9b6', align: 'center' }).setOrigin(0.5, 0);
    this.container = scene.add.container(model.x, model.y, [this.graphics, this.label]).setDepth(8);
    this.update(false);
  }

  update(selected: boolean, hovered = false): void {
    const { model, graphics: g } = this;
    this.container.setPosition(model.x, model.y);
    g.clear();
    if (!model.alive) {
      g.lineStyle(2, 0xa58071, 0.35).strokeCircle(0, 0, 14);
      this.label.setText(`${Math.ceil(model.respawnRemaining)}s 重生`).setColor('#a39480');
      return;
    }
    const friendly = model.team === 'blue';
    const color = friendly ? 0x4b99b1 : 0xb66055;
    g.fillStyle(0x10251f, 0.6).fillEllipse(3, 13, 48, 25);
    if (selected || hovered) g.lineStyle(selected ? 3 : 2, selected ? 0xf4a07c : friendly ? 0x9cd8da : 0xffd999, 0.95).strokeEllipse(0, 6, 61, 38);
    if (this.index === 2) {
      g.fillStyle(0x263b37).fillCircle(-21, 10, 8).fillCircle(21, 10, 8);
      g.fillStyle(color).fillRoundedRect(-23, -14, 46, 29, 5);
      g.fillStyle(0xdbc394).fillRect(-5, -29, 10, 23);
    } else {
      g.fillStyle(color).fillTriangle(-21, 19, 21, 19, 0, -23);
      g.fillStyle(friendly ? 0xb1d8d0 : 0xd9b28e).fillCircle(0, -7, 10);
      g.fillStyle(friendly ? 0x2b5262 : 0x663c3a).fillTriangle(-9, -7, 9, -7, 0, -21);
      g.lineStyle(4, 0xd3bf93).lineBetween(17, -11, 24, 18);
    }
    if (model.hitFlash > 0) g.fillStyle(0xffe6b4, model.hitFlash / 0.15 * 0.7).fillCircle(0, 0, 24);
    // 所有靶兵（含友方）始终显示血条。
    const bar = TARGET_LAYOUT.healthBar;
    g.fillStyle(0x0a1a18, 0.9).fillRect(bar.x, bar.y, bar.width, bar.height);
    g.fillStyle(friendly ? 0x74c8d0 : 0xdc7f64).fillRect(bar.x + 2, bar.y + 2, (bar.width - 4) * model.health / model.config.maxHealth, bar.height - 4);
    g.lineStyle(hovered ? 2 : 1, hovered ? 0xffd999 : 0xc8c29a, hovered ? 0.9 : 0.4).strokeRect(bar.x, bar.y, bar.width, bar.height);
    this.label.setText(`${model.name}\n${Math.ceil(model.health)} / ${model.config.maxHealth}`)
      .setColor(friendly ? '#a7d1d0' : hovered ? '#ffe3a4' : '#e4c9b6');
  }
}
