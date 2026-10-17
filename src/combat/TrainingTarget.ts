import type { Point } from '../simulation/Movement';
import type { AttackTarget, Team } from './AttackTarget';
export type { AttackTarget, Team } from './AttackTarget';
export interface TargetConfig { maxHealth: number; armor: number; collisionRadius: number; respawnSeconds: number }

/** 第二阶段的静止验证靶；不包含小兵波次或 AI。 */
export class TrainingTarget implements AttackTarget {
  generation = 0;
  health: number;
  respawnRemaining = 0;
  hitFlash = 0;
  x: number;
  y: number;
  readonly collisionRadius: number;

  constructor(readonly id: string, readonly name: string, readonly team: Team, position: Point, readonly config: TargetConfig) {
    this.x = position.x;
    this.y = position.y;
    this.health = config.maxHealth;
    this.collisionRadius = config.collisionRadius;
  }

  get alive(): boolean { return this.health > 0; }

  receiveDamage(rawDamage: number): number {
    if (!this.alive || this.team !== 'red') return 0;
    const amount = Math.min(this.health, rawDamage * 100 / (100 + Math.max(0, this.config.armor)));
    this.health -= amount;
    this.hitFlash = 0.15;
    if (!this.alive) this.respawnRemaining = this.config.respawnSeconds;
    return amount;
  }

  update(dt: number): void {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.alive) return;
    this.respawnRemaining -= dt;
    if (this.respawnRemaining <= 1e-9) {
      this.health = this.config.maxHealth;
      this.respawnRemaining = 0;
      this.generation++;
    }
  }
}
