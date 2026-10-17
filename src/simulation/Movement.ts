export interface Point { x: number; y: number }
export interface Bounds { width: number; height: number }
export interface MovementConstraint {
  contains(point: Point, radius: number): boolean;
  project(point: Point, radius: number): Point;
}
export interface MovementConfig {
  moveSpeed: number;
  collisionRadius: number;
  turnSpeed: number;
  arrivalDistance: number;
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** 不依赖 Phaser 的移动模型，便于验证不同帧率与边界行为。 */
export class Movement {
  x: number;
  y: number;
  heading = -Math.PI / 2;
  velocity: Point = { x: 0, y: 0 };
  target: Point | null = null;

  constructor(spawn: Point, readonly config: MovementConfig, readonly bounds: Bounds, readonly constraint?: MovementConstraint) {
    this.x = spawn.x;
    this.y = spawn.y;
  }

  moveTo(point: Point): void {
    const r = this.config.collisionRadius;
    this.target = {
      x: Math.max(r, Math.min(this.bounds.width - r, point.x)),
      y: Math.max(r, Math.min(this.bounds.height - r, point.y)),
    };
    if (this.constraint) this.target = this.constraint.project(this.target, r);
  }

  stop(): void {
    this.target = null;
    this.velocity.x = this.velocity.y = 0;
  }

  faceTowards(point: Point, dt: number): number {
    const desiredHeading = Math.atan2(point.y - this.y, point.x - this.x);
    const difference = wrapAngle(desiredHeading - this.heading);
    const maxTurn = this.config.turnSpeed * dt;
    this.heading = wrapAngle(this.heading + Math.max(-maxTurn, Math.min(maxTurn, difference)));
    return wrapAngle(desiredHeading - this.heading);
  }

  /** 调用者用小步长推进。转向和位移均按秒计算。 */
  step(dt: number): void {
    if (dt <= 0 || !this.target) return;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= this.config.arrivalDistance) {
      this.stop();
      return;
    }
    const remainingAngle = this.faceTowards(this.target, dt);
    const alignment = Math.max(0, Math.cos(remainingAngle));
    const speed = Math.min(this.config.moveSpeed, distance * 12) * alignment;
    const travel = Math.min(speed * dt, distance);
    const r = this.config.collisionRadius;
    let next = {
      x: Math.max(r, Math.min(this.bounds.width - r, this.x + Math.cos(this.heading) * travel)),
      y: Math.max(r, Math.min(this.bounds.height - r, this.y + Math.sin(this.heading) * travel)),
    };
    // 已在道路内时，转向弧线也不能越界；外部位移到路外的单位则自然走回。
    if (this.constraint?.contains(this, r)) next = this.constraint.project(next, r);
    this.velocity.x = (next.x - this.x) / dt;
    this.velocity.y = (next.y - this.y) / dt;
    this.x = next.x;
    this.y = next.y;
  }
}

/** 将渲染帧的 delta time 拆成小步；不按渲染帧数移动。 */
export function advanceMovement(model: Movement, deltaSeconds: number, maxStep = 1 / 120): void {
  let remaining = deltaSeconds;
  while (remaining > 1e-9) {
    const step = Math.min(remaining, maxStep);
    model.step(step);
    remaining -= step;
  }
}
