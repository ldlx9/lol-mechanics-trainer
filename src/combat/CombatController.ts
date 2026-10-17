import { BasicAttack } from './BasicAttack';
import type { AttackTimingConfig, TargetRef } from './BasicAttack';
import type { AttackTarget } from './AttackTarget';
import { Movement } from '../simulation/Movement';
import type { Point } from '../simulation/Movement';
import { targetHitPriority } from './TargetSelection';

export interface CombatConfig extends AttackTimingConfig {
  projectileSpeed: number;
  attackRange: number;
  attackDamage: number;
  cursorAcquireRadius: number;
  attackMoveAcquireRadius: number;
  attackMoveRule: 'nearest-player-while-moving' | 'move-only';
}
export interface BasicProjectile extends Point {
  id: number;
  target: TargetRef;
  damage: number;
}
export type CombatOrder = { kind: 'idle' } | { kind: 'move'; destination: Point }
  | { kind: 'attack'; targetId: string } | { kind: 'attackMove'; destination: Point };
export interface HitFeedback extends Point { damage: number; age: number }

/** 指令、追击、状态机和弹道均使用同一组小时间步推进。 */
export class CombatController {
  readonly attack: BasicAttack;
  order: CombatOrder = { kind: 'idle' };
  activeTarget: AttackTarget | null = null;
  projectiles: BasicProjectile[] = [];
  hits: HitFeedback[] = [];
  shotsFired = 0;
  hitsLanded = 0;
  cancelledWindups = 0;
  feedback = '';
  feedbackUntil = 0;
  private nextProjectileId = 0;

  constructor(readonly motion: Movement, readonly targets: AttackTarget[], readonly config: CombatConfig, private readonly maxStep = 1 / 120) {
    this.attack = new BasicAttack(config);
  }

  moveTo(point: Point): void {
    if (this.attack.cancelForMovement()) {
      this.cancelledWindups++;
      this.showFeedback('前摇已取消 · 没有发射弹道');
    }
    this.motion.moveTo(point);
    this.order = { kind: 'move', destination: { ...this.motion.target! } };
    this.activeTarget = null;
  }

  stop(): void {
    if (this.attack.stop()) this.cancelledWindups++;
    this.motion.stop();
    this.order = { kind: 'idle' };
    this.activeTarget = null;
    this.showFeedback('已停止 · S 键停止移动与攻击');
  }

  /** 训练开关清场，取消失效目标；普通地面移动仍继续。 */
  onTargetsRemoved(): void {
    this.attack.stop();
    this.activeTarget = null;
    this.projectiles = [];
    this.hits = [];
    if (this.order.kind === 'attack') {
      this.motion.stop();
      this.order = { kind: 'idle' };
    } else if (this.order.kind === 'attackMove') this.motion.moveTo(this.order.destination);
  }

  attackTarget(target: AttackTarget): boolean {
    if (!this.isEnemy(target)) {
      this.showFeedback('友方单位不可攻击');
      return false;
    }
    this.cancelChangedWindup(target);
    this.order = { kind: 'attack', targetId: target.id };
    this.activeTarget = target;
    return true;
  }

  attackMove(point: Point): void {
    // 鼠标附近优先指定目标，包括需要追击的目标。
    const nearCursor = this.nearestEnemy(point, this.config.cursorAcquireRadius);
    if (nearCursor) {
      this.attackTarget(nearCursor);
      return;
    }
    const acquired = this.config.attackMoveRule === 'nearest-player-while-moving'
      ? this.nearestEnemy(this.motion, this.config.attackMoveAcquireRadius) : null;
    this.cancelChangedWindup(acquired);
    this.activeTarget = acquired;
    this.motion.moveTo(point);
    this.order = { kind: 'attackMove', destination: { ...this.motion.target! } };
  }

  pickTarget(point: Point): AttackTarget | null {
    // 敌我都参与点击检测，由 attackTarget 拒绝友方，避免点友方穿透选中身后的敌人。
    const candidates = this.targets.map(target => ({ target, priority: targetHitPriority(target, point) }))
      .filter((candidate): candidate is { target: AttackTarget; priority: number } => candidate.priority !== null);
    candidates.sort((a, b) => a.priority - b.priority
      || Math.hypot(a.target.x - point.x, a.target.y - point.y) - Math.hypot(b.target.x - point.x, b.target.y - point.y));
    return candidates[0]?.target ?? null;
  }

  /** 无需 A 前缀，普通左键命中单位即下达持续普攻；普通左键地面不寻敌。 */
  leftClick(point: Point, attackMoveArmed = false): boolean {
    const target = this.pickTarget(point);
    if (target) {
      this.attackTarget(target);
      return true;
    }
    if (attackMoveArmed) {
      this.attackMove(point);
      return true;
    }
    return false;
  }

  get inAttackRange(): boolean { return this.activeTarget !== null && this.inRange(this.activeTarget); }

  update(deltaSeconds: number): void {
    let remaining = deltaSeconds;
    while (remaining > 1e-9) {
      const dt = Math.min(remaining, this.maxStep);
      this.step(dt);
      remaining -= dt;
    }
  }

  step(dt: number, advanceTargets = true): void {
    if (advanceTargets) for (const target of this.targets) target.update(dt);
    this.resolveOrder(dt);
    const locked = this.attack.target;
    const windingTarget = locked && this.targets.find(t => t.id === locked.id && t.generation === locked.generation);
    const valid = !!windingTarget && this.isEnemy(windingTarget) && this.inRange(windingTarget);
    const release = this.attack.advance(dt, valid);
    if (release) {
      this.shotsFired++;
      this.projectiles.push({ id: this.nextProjectileId++, x: this.motion.x, y: this.motion.y, target: release, damage: this.config.attackDamage });
    }
    this.motion.step(dt);
    this.advanceProjectiles(dt);
    for (const hit of this.hits) hit.age += dt;
    this.hits = this.hits.filter(hit => hit.age < 0.7);
  }

  private resolveOrder(dt: number): void {
    if (this.order.kind === 'idle') return;
    if (this.order.kind === 'move') {
      if (!this.motion.target) this.order = { kind: 'idle' };
      return;
    }
    if (this.order.kind === 'attack') {
      const targetId = this.order.targetId;
      const target = this.targets.find(t => t.id === targetId);
      if (!target || !this.isEnemy(target)) {
        this.attack.cancelWindup();
        this.motion.stop();
        this.activeTarget = null;
        this.order = { kind: 'idle' };
        return;
      }
      this.activeTarget = target;
    } else {
      // 攻击移动保留当前有效目标；击杀后继续向原目的地推进并寻敌。
      if (!this.activeTarget || !this.isEnemy(this.activeTarget)) {
        this.activeTarget = this.config.attackMoveRule === 'nearest-player-while-moving'
          ? this.nearestEnemy(this.motion, this.config.attackMoveAcquireRadius) : null;
      }
      if (!this.activeTarget) {
        this.motion.moveTo(this.order.destination);
        return;
      }
    }
    const target = this.activeTarget;
    if (!target) return;
    if (!this.inRange(target)) {
      this.attack.cancelWindup();
      this.motion.moveTo(target);
      return;
    }
    this.motion.stop();
    const facingError = this.motion.faceTowards(target, dt);
    if (Math.abs(facingError) <= 0.15 && this.attack.canStart) {
      this.attack.start({ id: target.id, generation: target.generation });
    }
  }

  private advanceProjectiles(dt: number): void {
    this.projectiles = this.projectiles.filter(projectile => {
      const target = this.targets.find(t => t.id === projectile.target.id && t.generation === projectile.target.generation);
      if (!target || !this.isEnemy(target)) return false;
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const travel = this.config.projectileSpeed * dt;
      // 沿运动段计算抵达，避免高速弹道跨过目标。普攻追随指定目标，不能误伤友方。
      if (distance <= travel + target.collisionRadius) {
        const damage = target.receiveDamage(projectile.damage, { id: 'player', team: 'blue', kind: 'player' });
        if (damage > 0) {
          this.hitsLanded++;
          this.hits.push({ x: target.x, y: target.y - 30, damage, age: 0 });
        }
        return false;
      }
      projectile.x += dx / distance * travel;
      projectile.y += dy / distance * travel;
      return true;
    });
  }

  private cancelChangedWindup(next: AttackTarget | null): void {
    if (this.attack.state === 'Windup' && this.attack.target?.id !== next?.id) this.attack.cancelWindup();
  }

  private isEnemy(target: AttackTarget): boolean { return target.team === 'red' && target.alive; }
  private inRange(target: AttackTarget): boolean {
    return Math.hypot(target.x - this.motion.x, target.y - this.motion.y)
      <= this.config.attackRange + this.motion.config.collisionRadius + target.collisionRadius;
  }
  private nearestEnemy(point: Point, radius: number): AttackTarget | null {
    return this.targets.filter(t => this.isEnemy(t) && Math.hypot(t.x - point.x, t.y - point.y) <= radius)
      .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0] ?? null;
  }
  private showFeedback(message: string): void {
    this.feedback = message;
    this.feedbackUntil = this.attack.now + 1.5;
  }
}
