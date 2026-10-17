export type AttackState = 'Idle' | 'Windup' | 'AttackReleased' | 'Recovery' | 'Ready';
export interface TargetRef { id: string; generation: number }
export interface AttackTimingConfig {
  attackSpeed: number;
  windupRatio: number;
  releaseFeedbackSeconds: number;
}

/** 纯时间状态机。移动只能取消动画，readyAt 是独立、不可绕过的冷却门槛。 */
export class BasicAttack {
  state: AttackState = 'Idle';
  now = 0;
  readyAt = 0;
  target: TargetRef | null = null;
  recoveryCancelled = false;
  private startedAt = 0;
  private windupEndsAt = 0;
  private releasedAt = 0;

  constructor(readonly config: AttackTimingConfig) {}

  get period(): number { return 1 / this.config.attackSpeed; }
  get windupSeconds(): number { return this.period * this.config.windupRatio; }
  get cooldownRemaining(): number { return Math.max(0, this.readyAt - this.now); }
  get canStart(): boolean {
    return this.state !== 'Windup' && this.now + 1e-9 >= this.readyAt;
  }
  get windupProgress(): number {
    return this.state === 'Windup' ? Math.min(1, (this.now - this.startedAt) / this.windupSeconds) : 0;
  }

  start(target: TargetRef): boolean {
    if (!this.canStart) return false;
    this.target = { ...target };
    this.startedAt = this.now;
    this.windupEndsAt = this.now + this.windupSeconds;
    this.recoveryCancelled = false;
    this.state = 'Windup';
    return true;
  }

  cancelWindup(): boolean {
    if (this.state !== 'Windup') return false;
    this.target = null;
    this.state = 'Idle';
    return true;
  }

  cancelForMovement(): boolean {
    if (this.cancelWindup()) return true;
    if (this.state === 'AttackReleased' || this.state === 'Recovery') {
      this.recoveryCancelled = true;
      this.state = this.cooldownRemaining <= 1e-9 ? 'Ready' : 'Recovery';
    }
    return false;
  }

  /** 停止指令结束动作；已经提交的攻击冷却 readyAt 保留。 */
  stop(): boolean {
    const cancelledWindup = this.cancelForMovement();
    this.target = null;
    this.state = 'Idle';
    return cancelledWindup;
  }

  /** 每次更新至多返回一个发射事件；前摇被取消时永远不返回事件。 */
  advance(dt: number, targetStillValid = true): TargetRef | null {
    this.now += dt;
    let release: TargetRef | null = null;
    if (this.state === 'Windup' && !targetStillValid) this.cancelWindup();
    if (this.state === 'Windup' && this.now + 1e-9 >= this.windupEndsAt) {
      release = this.target && { ...this.target };
      this.releasedAt = this.windupEndsAt;
      this.readyAt = this.startedAt + this.period;
      this.state = 'AttackReleased';
    }
    const feedback = Math.min(this.config.releaseFeedbackSeconds, this.period * 0.15);
    if (this.state === 'AttackReleased' && this.now + 1e-9 >= this.releasedAt + feedback) this.state = 'Recovery';
    if (this.state === 'Recovery' && this.now + 1e-9 >= this.readyAt) {
      this.state = 'Ready';
      this.target = null;
      this.recoveryCancelled = false;
    }
    return release;
  }
}
