import type { DamageSource, Team } from '../combat/AttackTarget';
import type { LaneConfig, MinionKind } from '../config/minions';
import type { Bounds, Point } from '../simulation/Movement';
import { LastHitStats } from '../stats/LastHitStats';
import { Minion } from './Minion';
import { RoadCorridor } from '../simulation/RoadCorridor';

export interface MinionProjectile extends Point {
  id: number;
  team: Team;
  source: DamageSource;
  targetId: string;
  speed: number;
  damage: number;
  bonusCurrentHealthRatio: number;
}
export interface MeleeEffect extends Point { toX: number; toY: number; team: Team; age: number }
interface AttackCommit { source: Minion; target: Minion }

export class LaneSystem {
  /** 保持数组引用稳定，玩家战斗系统直接使用这组目标。 */
  readonly minions: Minion[] = [];
  projectiles: MinionProjectile[] = [];
  meleeEffects: MeleeEffect[] = [];
  time = 0;
  wave = 0;
  nextWaveAt: number;
  waveSuppressed = false;
  readonly road: RoadCorridor;
  private nextProjectileId = 0;
  private active = true;

  constructor(readonly config: LaneConfig, readonly bounds: Bounds, readonly stats = new LastHitStats()) {
    this.nextWaveAt = config.firstWaveDelay;
    this.road = new RoadCorridor({ center: config.center, slope: config.slope, halfWidth: config.roadHalfWidth, edgeInset: config.roadEdgeInset }, bounds);
  }

  get blueCount(): number { return this.minions.filter(m => m.alive && m.team === 'blue').length; }
  get redCount(): number { return this.minions.filter(m => m.alive && m.team === 'red').length; }
  get untilNextWave(): number { return Math.max(0, this.nextWaveAt - this.time); }
  get enabled(): boolean { return this.active; }

  setEnabled(enabled: boolean): void {
    if (this.active === enabled) return;
    this.active = enabled;
    this.waveSuppressed = false;
    if (!enabled) {
      for (const minion of this.minions) minion.despawn();
      // 不替换数组，玩家和技能系统持有的目标引用也会立即变空。
      this.minions.length = 0;
      this.projectiles = [];
      this.meleeEffects = [];
    } else this.nextWaveAt = this.time + this.config.firstWaveDelay;
  }

  step(dt: number): void {
    this.time += dt;
    if (!this.active) return;
    while (this.time + 1e-9 >= this.nextWaveAt) {
      this.wave++;
      const count = this.config.meleePerWave + this.config.rangedPerWave + (this.isCannonWave(this.wave) ? 1 : 0);
      this.waveSuppressed = this.minions.filter(m => m.alive).length + count * 2 > this.config.maxActiveMinions;
      if (!this.waveSuppressed) this.spawnWave(this.wave);
      this.nextWaveAt += this.config.waveInterval;
    }
    for (const minion of this.minions) minion.update(dt);
    const living = this.minions.filter(m => m.alive);
    const byId = new Map(living.map(m => [m.id, m]));
    const commits: AttackCommit[] = [];
    // 先决定双方动作并提交发射事件，再统一结算伤害，避免固定的蓝方先手优势。
    for (const minion of living) {
      const outside = !this.road.contains(minion, minion.collisionRadius);
      const stillReturning = minion.returningToRoad && !this.road.contains(minion, minion.collisionRadius, this.config.roadReturnInset / 2);
      if (outside || stillReturning) {
        minion.returningToRoad = true;
        minion.targetId = null;
        minion.exitAge = 0;
        minion.attack.cancelWindup();
        minion.attack.advance(dt, false);
        minion.motion.moveTo(this.road.project(minion, minion.collisionRadius, this.config.roadReturnInset));
        continue;
      }
      minion.returningToRoad = false;
      let target = minion.targetId ? byId.get(minion.targetId) : undefined;
      if (!target || target.team === minion.team || !this.canEngage(target) || this.distance(minion, target) > this.config.leashRange) {
        target = this.nearestEnemy(minion, living);
      }
      if (target?.id !== minion.targetId) minion.attack.cancelWindup();
      minion.targetId = target?.id ?? null;
      const inRange = !!target && this.inRange(minion, target);
      if (target && inRange) {
        minion.motion.stop();
        const error = minion.motion.faceTowards(target, dt);
        if (Math.abs(error) < 0.2 && minion.attack.canStart) minion.attack.start({ id: target.id, generation: target.generation });
      } else if (target) {
        minion.attack.cancelWindup();
        if (minion.kind === 'melee') {
          // 行军保持单列；接敌时分成三个近战位置，避免后排被领头兵挡住。
          const forward = this.direction();
          const sign = minion.team === 'blue' ? 1 : -1;
          const flank = (minion.formationIndex % 3 - 1) * this.config.meleeFormationSpacing;
          minion.motion.moveTo({
            x: target.x - forward.x * sign * this.config.meleeApproachDistance - forward.y * flank,
            y: target.y - forward.y * sign * this.config.meleeApproachDistance + forward.x * flank,
          });
        } else minion.motion.moveTo(target);
      } else {
        minion.attack.cancelWindup();
        minion.motion.moveTo(minion.destination);
      }
      const release = minion.attack.advance(dt, inRange);
      if (release && target) commits.push({ source: minion, target });
    }
    for (const minion of living) {
      minion.motion.step(dt);
      // 出口是一个区域；进入后不会因同列后排兵的轻微推挤而反复清零计时。
      if (!minion.returningToRoad && !minion.targetId && (minion.exitAge > 0 || this.distance(minion, minion.destination) <= this.config.exitRadius)) {
        minion.exitAge += dt;
        if (minion.exitAge >= this.config.exitWaitSeconds) { minion.exited = true; minion.motion.stop(); }
      } else minion.exitAge = 0;
    }
    this.separate(living, dt);
    for (const { source, target } of commits) {
      const damageSource: DamageSource = { id: source.id, team: source.team, kind: 'minion' };
      if (source.kind === 'melee') {
        this.dealMinionDamage(target, source.stats.attackDamage, source.stats.bonusCurrentHealthRatio, damageSource);
        this.meleeEffects.push({ x: source.x, y: source.y, toX: target.x, toY: target.y, team: source.team, age: 0 });
      } else {
        this.projectiles.push({ id: this.nextProjectileId++, x: source.x, y: source.y, source: damageSource, team: source.team,
          targetId: target.id, speed: source.stats.projectileSpeed, damage: source.stats.attackDamage, bonusCurrentHealthRatio: source.stats.bonusCurrentHealthRatio });
      }
    }
    this.advanceProjectiles(dt);
    for (const effect of this.meleeEffects) effect.age += dt;
    this.meleeEffects = this.meleeEffects.filter(effect => effect.age < 0.18);
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const minion = this.minions[i];
      if (minion.exited || (!minion.alive && minion.deathAge >= this.config.deathSeconds)) this.minions.splice(i, 1);
    }
  }

  isCannonWave(wave: number): boolean {
    return wave >= this.config.firstCannonWave && (wave - this.config.firstCannonWave) % this.config.cannonEveryWaves === 0;
  }

  private spawnWave(wave: number): void {
    for (const team of ['blue', 'red'] as const) {
      let queueIndex = 0;
      for (let i = 0; i < this.config.meleePerWave; i++) this.spawn(team, 'melee', wave, i, queueIndex++);
      for (let i = 0; i < this.config.rangedPerWave; i++) this.spawn(team, 'ranged', wave, i, queueIndex++);
      if (this.isCannonWave(wave)) this.spawn(team, 'cannon', wave, 0, queueIndex);
    }
  }

  private spawn(team: Team, kind: MinionKind, wave: number, index: number, queueIndex: number): void {
    const forward = this.direction();
    const sign = team === 'blue' ? 1 : -1;
    const distance = this.config.frontSpawnDistance + queueIndex * this.config.queueSpacing;
    const center = this.config.center;
    const position = { x: center.x - forward.x * distance * sign, y: center.y - forward.y * distance * sign };
    const destination = { x: center.x + forward.x * this.config.routeEndDistance * sign, y: center.y + forward.y * this.config.routeEndDistance * sign };
    const base = this.config.stats[kind];
    const growth = Math.floor((this.time + 1e-9) / this.config.growthInterval);
    const stats = { ...base, maxHealth: base.maxHealth + base.healthGrowth * growth, attackDamage: base.attackDamage + base.damageGrowth * growth };
    this.minions.push(new Minion(`${team}-${wave}-${kind}-${index}`, team, kind, wave, position, destination, stats, this.bounds, death => this.stats.record(death), index, this.road));
  }

  private direction(): Point {
    return this.road.forward;
  }
  private canEngage(minion: Minion): boolean {
    return minion.alive && !minion.returningToRoad && this.road.contains(minion, minion.collisionRadius);
  }
  private nearestEnemy(minion: Minion, living: Minion[]): Minion | undefined {
    let closest: Minion | undefined;
    let best = this.config.acquireRange;
    for (const candidate of living) {
      if (candidate.team === minion.team || !this.canEngage(candidate)) continue;
      const distance = this.distance(minion, candidate);
      if (distance < best - 1e-9) { closest = candidate; best = distance; }
    }
    return closest;
  }
  private distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
  private inRange(source: Minion, target: Minion): boolean {
    return this.distance(source, target) <= source.stats.attackRange + source.collisionRadius + target.collisionRadius;
  }
  private dealMinionDamage(target: Minion, base: number, bonusRatio: number, source: DamageSource): void {
    target.receiveDamage(base + target.health * bonusRatio, source);
  }
  private advanceProjectiles(dt: number): void {
    const targets = new Map(this.minions.filter(m => m.alive).map(m => [m.id, m]));
    this.projectiles = this.projectiles.filter(p => {
      const target = targets.get(p.targetId);
      if (!target || !target.alive || target.team === p.team) return false;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const distance = Math.hypot(dx, dy);
      const travel = p.speed * dt;
      if (distance <= travel + target.collisionRadius) {
        this.dealMinionDamage(target, p.damage, p.bonusCurrentHealthRatio, p.source);
        return false;
      }
      p.x += dx / distance * travel;
      p.y += dy / distance * travel;
      return true;
    });
  }

  private separate(minions: Minion[], dt: number): void {
    const cap = this.config.separationSpeed * dt;
    for (let pass = 0; pass < this.config.separationPasses; pass++) {
      for (let i = 0; i < minions.length; i++) {
        for (let j = i + 1; j < minions.length; j++) {
          const a = minions[i]; const b = minions[j];
          if (!a.alive || !b.alive || a.returningToRoad || b.returningToRoad) continue;
          const dx = b.x - a.x; const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          const minimum = a.collisionRadius + b.collisionRadius + 1;
          if (distance >= minimum) continue;
          const nx = distance > 1e-9 ? dx / distance : 1;
          const ny = distance > 1e-9 ? dy / distance : 0;
          const correction = Math.min((minimum - distance) / 2, cap);
          a.x -= nx * correction; a.y -= ny * correction;
          b.x += nx * correction; b.y += ny * correction;
          this.clamp(a); this.clamp(b);
        }
      }
    }
  }

  private clamp(minion: Minion): void {
    const r = minion.collisionRadius;
    minion.x = Math.max(r, Math.min(this.bounds.width - r, minion.x));
    minion.y = Math.max(r, Math.min(this.bounds.height - r, minion.y));
    if (!minion.returningToRoad) {
      const position = this.road.project(minion, r);
      minion.x = position.x; minion.y = position.y;
    }
  }
}
