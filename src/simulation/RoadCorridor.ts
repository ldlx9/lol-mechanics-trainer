import type { Bounds, MovementConstraint, Point } from './Movement';

export interface RoadShape { center: Point; slope: number; halfWidth: number; edgeInset: number }

/** 道路带与世界矩形的凸交集。按单位半径收边，保证整个身体留在道路内。 */
export class RoadCorridor implements MovementConstraint {
  readonly forward: Point;
  readonly normal: Point;
  private readonly polygons = new Map<string, Point[]>();

  constructor(readonly shape: RoadShape, readonly bounds: Bounds) {
    const length = Math.hypot(1, shape.slope);
    this.forward = { x: 1 / length, y: -shape.slope / length };
    this.normal = { x: shape.slope / length, y: 1 / length };
  }

  signedDistance(point: Point): number {
    return (point.x - this.shape.center.x) * this.normal.x + (point.y - this.shape.center.y) * this.normal.y;
  }

  private allowance(radius: number, inset: number): number {
    return Math.max(0, this.shape.halfWidth - this.shape.edgeInset - radius - inset);
  }

  contains(point: Point, radius: number, inset = 0): boolean {
    const epsilon = 1e-7;
    return point.x >= radius - epsilon && point.x <= this.bounds.width - radius + epsilon
      && point.y >= radius - epsilon && point.y <= this.bounds.height - radius + epsilon
      && Math.abs(this.signedDistance(point)) <= this.allowance(radius, inset) + epsilon;
  }

  project(point: Point, radius: number, inset = 0): Point {
    if (this.contains(point, radius, inset)) return { x: point.x, y: point.y };
    const key = `${radius}:${inset}`;
    let polygon = this.polygons.get(key);
    if (!polygon) {
      polygon = [
        { x: radius, y: radius }, { x: this.bounds.width - radius, y: radius },
        { x: this.bounds.width - radius, y: this.bounds.height - radius }, { x: radius, y: this.bounds.height - radius },
      ];
      const limit = this.allowance(radius, inset);
      polygon = this.clip(polygon, 1, limit);
      polygon = this.clip(polygon, -1, limit);
      if (!polygon.length) throw new Error('道路与世界边界没有可通行交集');
      this.polygons.set(key, polygon);
    }
    let closest = polygon[0];
    let bestDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]; const b = polygon[(i + 1) % polygon.length];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared > 1e-12 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
      const candidate = { x: a.x + dx * t, y: a.y + dy * t };
      const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
      if (distance < bestDistance) { closest = candidate; bestDistance = distance; }
    }
    return { ...closest };
  }

  private clip(polygon: Point[], sign: number, limit: number): Point[] {
    const result: Point[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]; const b = polygon[(i + 1) % polygon.length];
      const da = this.signedDistance(a) * sign - limit;
      const db = this.signedDistance(b) * sign - limit;
      if (da <= 0) result.push(a);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return result;
  }
}
