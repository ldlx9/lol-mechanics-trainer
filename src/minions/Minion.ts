import { BasicAttack } from '../combat/BasicAttack';
import type { AttackTarget, DamageSource, Team } from '../combat/AttackTarget';
import type { MinionKind, MinionStats } from '../config/minions';
import { Movement } from '../simulation/Movement';
import type { Bounds, Point } from '../simulation/Movement';
import type { RoadCorridor } from '../simulation/RoadCorridor';
import type { MinionDeath } from '../stats/LastHitStats';

export class Minion implements AttackTarget {
  readonly generation = 0;
  readonly motion: Movement;
  readonly attack: BasicAttack;
  readonly collisionRadius: number;
  readonly name: string;
  health: number;
  hitFlash = 0;
  deathAge = 0;
  exitAge = 0;
  exited = false;
  targetId: string | null = null;
  returningToRoad = false;
  deathSource?: DamageSource;

  constructor(readonly id: string, readonly team: Team, readonly kind: MinionKind, readonly wave: number,
    position: Point, readonly destination: Point, readonly stats: MinionStats, bounds: Bounds,
    private readonly onDeath: (death: MinionDeath) => void, readonly formationIndex = 0, road?: RoadCorridor) {
    this.health = stats.maxHealth;
    this.collisionRadius = stats.collisionRadius;
    const r = this.collisionRadius;
    this.destination = { x: Math.max(r, Math.min(bounds.width - r, destination.x)), y: Math.max(r, Math.min(bounds.height - r, destination.y)) };
    if (road) this.destination = road.project(this.destination, r);
    this.name = `${team === 'blue' ? '蓝方' : '红方'}${{ melee: '近战兵', ranged: '远程兵', cannon: '炮车兵' }[kind]}`;
    this.motion = new Movement(road?.project(position, r) ?? position,
      { moveSpeed: stats.moveSpeed, collisionRadius: stats.collisionRadius, turnSpeed: 12, arrivalDistance: 1.5 }, bounds, road);
    this.motion.heading = Math.atan2(this.destination.y - this.y, this.destination.x - this.x);
    this.attack = new BasicAttack({ attackSpeed: 1 / stats.attackInterval, windupRatio: stats.windupRatio, releaseFeedbackSeconds: 0.04 });
  }

  get x(): number { return this.motion.x; }
  set x(value: number) { this.motion.x = value; }
  get y(): number { return this.motion.y; }
  set y(value: number) { this.motion.y = value; }
  get alive(): boolean { return this.health > 0 && !this.exited; }

  receiveDamage(rawDamage: number, source?: DamageSource): number {
    if (!this.alive || source?.team === this.team) return 0;
    const damage = Math.min(this.health, Math.max(0, rawDamage) * 100 / (100 + Math.max(0, this.stats.armor)));
    if (damage <= 0) return 0;
    this.health -= damage;
    this.hitFlash = 0.14;
    if (this.health <= 0) {
      this.deathAge = 0;
      this.deathSource = source;
      this.motion.stop();
      this.attack.cancelWindup();
      this.onDeath({ id: this.id, team: this.team, kind: this.kind, source, x: this.x, y: this.y });
    }
    return damage;
  }

  update(dt: number): void {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (!this.alive) this.deathAge += dt;
  }

  /** 开关清场：立即失活并清除动作，不发送补刀死亡事件。 */
  despawn(): void {
    this.health = 0;
    this.exited = true;
    this.targetId = null;
    this.motion.stop();
    this.attack.stop();
  }
}
