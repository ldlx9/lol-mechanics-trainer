import type { Point } from './Movement';

export interface ViewRect extends Point { width: number; height: number }

/** 两个运动圆的相对扫掠，返回 [0,1] 内最早接触时刻；避免高速跨过而漏判。 */
export function sweptCircleTime(a0: Point, a1: Point, b0: Point, b1: Point, radius: number): number | null {
  const x = a0.x - b0.x;
  const y = a0.y - b0.y;
  const vx = a1.x - a0.x - (b1.x - b0.x);
  const vy = a1.y - a0.y - (b1.y - b0.y);
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = vx * vx + vy * vy;
  if (a < 1e-12) return null;
  const b = 2 * (x * vx + y * vy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= -1e-9 && t <= 1 + 1e-9 ? Math.max(0, Math.min(1, t)) : null;
}

export function insideRect(point: Point, rect: ViewRect, padding = 0): boolean {
  return point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding
    && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding;
}

/** 从矩形内部沿单位向量射出，到边界的距离。 */
export function rayExitDistance(point: Point, direction: Point, rect: ViewRect): number {
  const tx = direction.x > 1e-9 ? (rect.x + rect.width - point.x) / direction.x
    : direction.x < -1e-9 ? (rect.x - point.x) / direction.x : Infinity;
  const ty = direction.y > 1e-9 ? (rect.y + rect.height - point.y) / direction.y
    : direction.y < -1e-9 ? (rect.y - point.y) / direction.y : Infinity;
  return Math.max(0, Math.min(tx, ty));
}
