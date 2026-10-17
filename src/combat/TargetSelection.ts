import type { Point } from '../simulation/Movement';
import type { AttackTarget } from './AttackTarget';

/** 渲染与点选共享布局，点击血条/名称时也能选中对应单位。单位：世界像素。 */
export const TARGET_LAYOUT = {
  labelY: 42,
  labelFontSize: 17,
  labelLineHeight: 20,
  minimumLabelWidth: 128,
  healthBar: { x: -34, y: -41, width: 68, height: 10 },
  selectionPadding: 6,
  bodyPadding: 14,
} as const;

/** 模型优先于血条，血条优先于名称，避免名称遮住其他单位的身体。 */
export function targetHitPriority(target: AttackTarget, point: Point): number | null {
  if (!target.alive) return null;
  const dx = point.x - target.x;
  const dy = point.y - target.y;
  if (Math.hypot(dx, dy) <= target.collisionRadius + TARGET_LAYOUT.bodyPadding) return 0;
  const { healthBar: bar, selectionPadding: pad } = TARGET_LAYOUT;
  if (dx >= bar.x - pad && dx <= bar.x + bar.width + pad && dy >= bar.y - pad && dy <= bar.y + bar.height + pad) return 1;
  const labelWidth = Math.max(TARGET_LAYOUT.minimumLabelWidth, [...target.name].length * TARGET_LAYOUT.labelFontSize);
  if (Math.abs(dx) <= labelWidth / 2 + pad && dy >= TARGET_LAYOUT.labelY - pad
    && dy <= TARGET_LAYOUT.labelY + TARGET_LAYOUT.labelLineHeight * 2 + pad) return 2;
  return null;
}
