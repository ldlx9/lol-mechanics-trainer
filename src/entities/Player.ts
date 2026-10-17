import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { PLAYER_FRAMES, PLAYER_VISUAL_CONFIG } from '../config/playerVisuals';
import type { PlayerFrameName } from '../config/playerVisuals';
import { Movement } from '../simulation/Movement';
import type { BasicAttack } from '../combat/BasicAttack';
import type { PlayerVitals } from '../combat/PlayerVitals';
import { PlayerAnimation } from './PlayerAnimation';

export class Player {
  readonly motion = new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world);
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly attackAura: Phaser.GameObjects.Graphics;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly hitAura: Phaser.GameObjects.Graphics;
  private readonly animation = new PlayerAnimation(GAME_CONFIG.player.moveSpeed);
  private currentFrame: PlayerFrameName | null = null;
  private facingLeft = false;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(this.motion.x, this.motion.y).setDepth(10);
    const shadow = scene.add.ellipse(0, 5, 46, 20, 0x081c19, 0.5);
    const selection = scene.add.graphics();
    selection.lineStyle(2, 0x7dddd0, 0.8).strokeEllipse(0, 2, 47, 25);
    selection.lineStyle(1, 0xa1ead9, 0.12).strokeEllipse(0, 2, 57, 32);
    for (const frame of Object.values(PLAYER_FRAMES)) {
      scene.textures.get(frame.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.body = scene.add.image(0, 0, PLAYER_FRAMES.idle.key);
    this.attackAura = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.hitAura = scene.add.graphics();
    this.container.add([shadow, selection, this.attackAura, this.body, this.hitAura, this.healthBar]);
    this.showFrame('idle');
  }

  updateVisuals(dt: number, attack: BasicAttack, vitals: PlayerVitals): void {
    const speed = Math.hypot(this.motion.velocity.x, this.motion.velocity.y);
    this.showFrame(this.animation.update(dt, speed, attack));
    // 立绘保持直立；转向仍由原移动模型计算，竖向附近不反复翻转。
    const horizontal = Math.cos(this.motion.heading);
    if (Math.abs(horizontal) > 0.15) this.facingLeft = horizontal < 0;
    this.body.setFlipX(this.facingLeft);
    const { anchor } = PLAYER_FRAMES[this.currentFrame!];
    this.body.setOrigin(this.facingLeft ? 1 - anchor.x : anchor.x, anchor.y);
    this.body.setPosition(0, 0);
    this.attackAura.clear();
    if (attack.state === 'Windup') {
      this.attackAura.lineStyle(3, 0xf0c879, 0.95).beginPath()
        .arc(0, 0, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * attack.windupProgress).strokePath();
    } else if (attack.state === 'AttackReleased' && !attack.recoveryCancelled) {
      this.attackAura.lineStyle(3, 0xa4f4dc, 0.8).strokeCircle(0, 0, 33);
      this.body.x = this.facingLeft ? 2 : -2;
    }
    this.hitAura.clear();
    this.body.setAlpha(vitals.invulnerable ? 0.5 + Math.sin(vitals.now * 28) * 0.2 : 1);
    if (vitals.hitFlash > 0) this.hitAura.lineStyle(4, 0xff918b, vitals.hitFlash / vitals.config.hitFlashSeconds).strokeCircle(0, 0, 37);
    this.healthBar.clear();
    const barY = -PLAYER_VISUAL_CONFIG.height - 14;
    this.healthBar.fillStyle(0x091d1b, 0.9).fillRoundedRect(-34, barY, 68, 11, 3);
    this.healthBar.fillStyle(vitals.health > vitals.config.maxHealth * 0.3 ? 0x8be4ba : 0xf18c80)
      .fillRect(-31, barY + 3, 62 * vitals.health / vitals.config.maxHealth, 5);
    this.healthBar.lineStyle(1, 0xc5e0bc, 0.55).strokeRoundedRect(-34, barY, 68, 11, 3);
    this.container.setPosition(this.motion.x, this.motion.y);
  }

  private showFrame(name: PlayerFrameName): void {
    if (this.currentFrame === name) return;
    const frame = PLAYER_FRAMES[name];
    this.body.setTexture(frame.key).setOrigin(frame.anchor.x, frame.anchor.y)
      .setScale(PLAYER_VISUAL_CONFIG.height / frame.sourceHeight);
    this.currentFrame = name;
  }
}
