import type { AttackTarget } from '../combat/AttackTarget';
import { PlayerVitals } from '../combat/PlayerVitals';
import { DODGE_DIFFICULTIES } from '../config/skillshots';
import type { DodgeConfig, DodgeDifficulty, SkillshotKind } from '../config/skillshots';
import type { Movement, Point } from '../simulation/Movement';
import { insideRect, rayExitDistance, sweptCircleTime } from '../simulation/geometry';
import type { ViewRect } from '../simulation/geometry';
import { DodgeStats } from '../stats/DodgeStats';

const diagonal = Math.SQRT1_2;
export const SHOT_DIRECTIONS = [
  { name: '北', x: 0, y: -1 }, { name: '东北', x: diagonal, y: -diagonal },
  { name: '东', x: 1, y: 0 }, { name: '东南', x: diagonal, y: diagonal },
  { name: '南', x: 0, y: 1 }, { name: '西南', x: -diagonal, y: diagonal },
  { name: '西', x: -1, y: 0 }, { name: '西北', x: -diagonal, y: -diagonal },
] as const;
export const SHOT_NAMES: Record<SkillshotKind, string> = { piercing: '穿透', spear: '长矛', energy: '能量' };
const kinds: SkillshotKind[] = ['piercing', 'spear', 'energy'];

export interface SkillProjectile extends Point {
  id: number;
  kind: SkillshotKind;
  readonly direction: Point;
  readonly origin: Point;
  readonly aimPoint: Point;
  readonly aimMode: 'current' | 'predicted' | 'offset' | 'manual';
  readonly sourceDirection: string;
  traveled: number;
  age: number;
  enteredView: boolean;
  threatened: boolean;
  touchedPlayer: boolean;
  hitIds: Set<string>;
}
export interface SkillImpact extends Point { age: number; damage: number; player: boolean; protected: boolean; kind: SkillshotKind }
interface Contact { t: number; id: string; target?: AttackTarget }
export interface FireOptions { kind?: SkillshotKind; directionIndex?: number; target?: Point }

/** 求匀速拦截时间；只用于发射瞬间的预测，发射后绝不重新瞄准。 */
export function interceptTime(origin: Point, target: Point, velocity: Point, speed: number, cap: number): number {
  const dx = target.x - origin.x; const dy = target.y - origin.y;
  const a = velocity.x ** 2 + velocity.y ** 2 - speed ** 2;
  const b = 2 * (dx * velocity.x + dy * velocity.y);
  const c = dx ** 2 + dy ** 2;
  let t = Math.sqrt(c) / speed;
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9 && -c / b > 0) t = -c / b;
  } else {
    const d = b * b - 4 * a * c;
    if (d >= 0) {
      const roots = [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)].filter(root => root > 0);
      if (roots.length) t = Math.min(...roots);
    }
  }
  return Math.max(0, Math.min(cap, t));
}

export class SkillshotSystem {
  projectiles: SkillProjectile[] = [];
  impacts: SkillImpact[] = [];
  readonly stats = new DodgeStats();
  time = 0;
  nextShotAt: number;
  lastShot = '等待屏外来袭';
  private active = true;
  private difficultyLevel: DodgeDifficulty = 'easy';
  private nextId = 0;
  private previousPlayer: Point;
  private previousMinions = new Map<string, Point>();

  constructor(readonly motion: Movement, readonly minions: AttackTarget[], readonly vitals: PlayerVitals,
    readonly config: DodgeConfig, private readonly random: () => number = Math.random) {
    this.nextShotAt = config.firstShotDelay;
    this.previousPlayer = { x: motion.x, y: motion.y };
  }

  get enabled(): boolean { return this.active; }
  get difficulty(): DodgeDifficulty { return this.difficultyLevel; }
  get shotInterval(): number { return this.config.interval / DODGE_DIFFICULTIES[this.difficultyLevel].frequencyMultiplier; }
  get maxActive(): number { return this.config.maxActive * DODGE_DIFFICULTIES[this.difficultyLevel].capacityMultiplier; }
  get untilNextShot(): number { return Math.max(0, this.nextShotAt - this.time); }

  setDifficulty(difficulty: DodgeDifficulty): void {
    if (this.difficultyLevel === difficulty) return;
    const remainingFraction = this.untilNextShot / this.shotInterval;
    this.difficultyLevel = difficulty;
    // 沿用当前冷却进度，避免切换后补发过期技能或重置已有弹道与统计。
    this.nextShotAt = this.time + Math.min(1, remainingFraction) * this.shotInterval;
  }

  setEnabled(enabled: boolean): void {
    if (this.active === enabled) return;
    this.active = enabled;
    // 主动清理不是躲避，也不结算任何未完成弹道。
    this.projectiles = [];
    this.impacts = [];
    if (enabled) this.nextShotAt = this.time + this.config.firstShotDelay / DODGE_DIFFICULTIES[this.difficultyLevel].frequencyMultiplier;
  }

  fire(view: ViewRect, options: FireOptions = {}): SkillProjectile | null {
    if (!this.active || this.projectiles.length >= this.maxActive) return null;
    const kind = options.kind ?? kinds[Math.floor(this.random() * kinds.length)];
    const side = SHOT_DIRECTIONS[options.directionIndex ?? Math.floor(this.random() * SHOT_DIRECTIONS.length)];
    const spec = this.config.kinds[kind];
    // 以玩家为参照沿八方向穿过当前可见矩形；整个头部及尾迹都在屏幕之外。
    const distance = rayExitDistance(this.motion, side, view) + Math.max(this.config.spawnMargin, spec.length + spec.width);
    const origin = { x: this.motion.x + side.x * distance, y: this.motion.y + side.y * distance };
    let aimPoint: Point = { x: this.motion.x, y: this.motion.y };
    let aimMode: SkillProjectile['aimMode'] = 'current';
    if (options.target) { aimPoint = { ...options.target }; aimMode = 'manual'; }
    else {
      const choice = this.random();
      if (choice < this.config.predictionProbability) {
        const t = interceptTime(origin, this.motion, this.motion.velocity, spec.speed, this.config.maxPredictionSeconds);
        const r = this.motion.config.collisionRadius;
        aimPoint = {
          x: Math.max(r, Math.min(this.motion.bounds.width - r, this.motion.x + this.motion.velocity.x * t)),
          y: Math.max(r, Math.min(this.motion.bounds.height - r, this.motion.y + this.motion.velocity.y * t)),
        };
        aimMode = 'predicted';
      } else if (choice < this.config.predictionProbability + this.config.offsetProbability) {
        const angle = this.random() * Math.PI * 2;
        const radius = Math.sqrt(this.random()) * this.config.randomOffsetRadius;
        aimPoint.x += Math.cos(angle) * radius; aimPoint.y += Math.sin(angle) * radius;
        aimMode = 'offset';
      }
    }
    const dx = aimPoint.x - origin.x; const dy = aimPoint.y - origin.y;
    const length = Math.hypot(dx, dy);
    const direction = length > 1e-9 ? { x: dx / length, y: dy / length } : { x: -side.x, y: -side.y };
    const p: SkillProjectile = { id: this.nextId++, kind, x: origin.x, y: origin.y, origin, aimPoint, aimMode, direction,
      sourceDirection: side.name, traveled: 0, age: 0, enteredView: false, threatened: false, touchedPlayer: false, hitIds: new Set() };
    this.projectiles.push(p);
    this.stats.fired++;
    this.lastShot = `${side.name} · ${SHOT_NAMES[kind]}`;
    return p;
  }

  step(dt: number, view: ViewRect): void {
    this.time += dt;
    this.vitals.step(dt);
    for (const impact of this.impacts) impact.age += dt;
    this.impacts = this.impacts.filter(impact => impact.age < this.config.feedbackSeconds);
    if (this.active) {
      while (this.time + 1e-9 >= this.nextShotAt) {
        this.fire(view);
        this.nextShotAt += Math.max(0.25, this.shotInterval * (1 + (this.random() * 2 - 1) * this.config.intervalJitter));
      }
      this.projectiles = this.projectiles.filter(p => this.advance(p, dt, view));
    }
    this.previousPlayer = { x: this.motion.x, y: this.motion.y };
    this.previousMinions = new Map(this.minions.filter(m => m.alive).map(m => [m.id, { x: m.x, y: m.y }]));
  }

  private markThreat(p: SkillProjectile): void {
    if (!p.threatened) { p.threatened = true; this.stats.threats++; }
  }

  /** 入屏时只评估一次：维持当时速度（碰到地图边缘后停下）是否会被此弹道击中。 */
  private isThreat(p: SkillProjectile, view: ViewRect): boolean {
    if (!this.vitals.canTakeDamage) return false;
    const spec = this.config.kinds[p.kind];
    const horizon = Math.min(this.config.maxLifetime - p.age, (spec.maxDistance - p.traveled) / spec.speed,
      (rayExitDistance(p, p.direction, view) + spec.width) / spec.speed);
    if (horizon <= 0) return false;
    const radius = this.motion.config.collisionRadius + spec.width / 2;
    const velocity = this.motion.velocity;
    const speed = Math.hypot(velocity.x, velocity.y);
    const r = this.motion.config.collisionRadius;
    const safe = { x: r, y: r, width: this.motion.bounds.width - 2 * r, height: this.motion.bounds.height - 2 * r };
    const movingSeconds = speed > 1e-9 ? Math.min(horizon, rayExitDistance(this.motion, { x: velocity.x / speed, y: velocity.y / speed }, safe) / speed) : horizon;
    const shotAt = (t: number) => ({ x: p.x + p.direction.x * spec.speed * t, y: p.y + p.direction.y * spec.speed * t });
    const playerEnd = { x: this.motion.x + velocity.x * movingSeconds, y: this.motion.y + velocity.y * movingSeconds };
    if (sweptCircleTime(p, shotAt(movingSeconds), this.motion, playerEnd, radius) !== null) return true;
    return movingSeconds < horizon && sweptCircleTime(shotAt(movingSeconds), shotAt(horizon), playerEnd, playerEnd, radius) !== null;
  }

  private advance(p: SkillProjectile, dt: number, view: ViewRect): boolean {
    const spec = this.config.kinds[p.kind];
    const from = { x: p.x, y: p.y };
    const beforeDistance = p.traveled;
    const travel = Math.max(0, Math.min(spec.speed * dt, spec.maxDistance - p.traveled));
    p.x += p.direction.x * travel; p.y += p.direction.y * travel;
    p.traveled += travel; p.age += dt;
    if (!p.enteredView && insideRect(p, view, spec.width / 2)) {
      p.enteredView = true;
      if (this.isThreat(p, view)) this.markThreat(p);
    }
    const contacts: Contact[] = [];
    if (!p.hitIds.has('player')) {
      const t = sweptCircleTime(from, p, this.previousPlayer, this.motion, spec.width / 2 + this.motion.config.collisionRadius);
      if (t !== null) contacts.push({ t, id: 'player' });
    }
    for (const minion of this.minions) {
      if (!minion.alive || minion.team !== 'blue' || p.hitIds.has(minion.id)) continue;
      const t = sweptCircleTime(from, p, this.previousMinions.get(minion.id) ?? minion, minion, spec.width / 2 + minion.collisionRadius);
      if (t !== null) contacts.push({ t, id: minion.id, target: minion });
    }
    // 同一时间步也先结算最早接触的单位，不能按数组顺序越过挡在前面的小兵。
    contacts.sort((a, b) => a.t - b.t || Number(!a.target) - Number(!b.target));
    for (const contact of contacts) {
      p.hitIds.add(contact.id);
      const distance = beforeDistance + travel * contact.t;
      const raw = spec.damage * (1 + (spec.maxDamageMultiplier - 1) * Math.min(1, distance / spec.damageScaleDistance));
      const x = from.x + (p.x - from.x) * contact.t;
      const y = from.y + (p.y - from.y) * contact.t;
      let damage: number;
      if (contact.target) damage = contact.target.receiveDamage(raw, { id: `skill-${p.id}`, team: 'red', kind: 'skill' });
      else {
        p.touchedPlayer = true;
        damage = this.vitals.receiveDamage(raw);
        if (damage > 0) { this.stats.hits++; this.markThreat(p); }
        else this.stats.protectedContacts++;
      }
      this.impacts.push({ x, y, age: 0, damage, player: !contact.target, protected: damage === 0, kind: p.kind });
      if (this.impacts.length > 48) this.impacts.shift();
      if (p.kind !== 'piercing') {
        if (contact.target) this.stats.blocked++;
        return false;
      }
    }
    const passedPlayer = (this.motion.x - p.x) * p.direction.x + (this.motion.y - p.y) * p.direction.y < 0;
    const leftBehind = p.enteredView && passedPlayer && !insideRect(p, view, spec.length + spec.width);
    if (leftBehind || p.traveled + 1e-9 >= spec.maxDistance || p.age + 1e-9 >= this.config.maxLifetime) {
      if (!p.touchedPlayer) {
        if (p.threatened) this.stats.dodges++;
        else this.stats.harmlessMisses++;
      }
      return false;
    }
    return true;
  }
}
