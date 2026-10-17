import type { VitalsConfig } from '../config/skillshots';

/** 独立于移动碰撞与普攻；归零后原地自动恢复，训练操作保持连续。 */
export class PlayerVitals {
  health: number;
  now = 0;
  invulnerableUntil = 0;
  hitFlash = 0;
  recoverAt: number | null = null;
  recoveries = 0;

  constructor(readonly config: VitalsConfig) { this.health = config.maxHealth; }
  get canTakeDamage(): boolean { return this.health > 0 && this.now + 1e-9 >= this.invulnerableUntil; }
  get invulnerable(): boolean { return !this.canTakeDamage; }

  step(dt: number): void {
    this.now += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.recoverAt !== null && this.now + 1e-9 >= this.recoverAt) {
      this.health = this.config.maxHealth;
      this.recoverAt = null;
      this.invulnerableUntil = this.now + this.config.recoveryInvulnerabilitySeconds;
      this.recoveries++;
    }
  }

  receiveDamage(rawDamage: number): number {
    if (!this.canTakeDamage || rawDamage <= 0) return 0;
    const damage = Math.min(this.health, rawDamage);
    this.health -= damage;
    this.hitFlash = this.config.hitFlashSeconds;
    this.invulnerableUntil = this.now + this.config.invulnerabilitySeconds;
    if (this.health <= 0) this.recoverAt = this.now + this.config.recoverSeconds;
    return damage;
  }
}
