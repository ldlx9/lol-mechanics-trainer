import type { SkillshotKind } from './skillshots';

/** 用户提供的单张像素素材；帧裁切只去除透明留白。 */
export interface SkillshotVisual {
  key: string;
  url: string;
  frame: { x: number; y: number; width: number; height: number };
  /** 在裁切帧中的弹头判定中心（0..1），与模拟位置重合。 */
  head: { x: number; y: number };
  /** 将素材自身的弹头朝向校正到飞行方向。 */
  rotationOffset: number;
  /** 世界坐标中的画面长度；尾迹不参与碰撞，保持在现有回收余量内。 */
  length: number;
}

export const SKILLSHOT_VISUALS: Record<SkillshotKind, SkillshotVisual> = {
  piercing: {
    key: 'skill-piercing', url: '/assets/skillshots/piercing.png',
    frame: { x: 37, y: 148, width: 2100, height: 444 }, head: { x: 0.03, y: 0.5 }, rotationOffset: Math.PI, length: 140,
  },
  spear: {
    key: 'skill-spear', url: '/assets/skillshots/spear.png',
    frame: { x: 5, y: 232, width: 2029, height: 348 }, head: { x: 0.97, y: 0.45 }, rotationOffset: 0, length: 100,
  },
  energy: {
    key: 'skill-energy', url: '/assets/skillshots/energy.png',
    frame: { x: 150, y: 156, width: 1732, height: 488 }, head: { x: 0.94, y: 0.57 }, rotationOffset: 0, length: 80,
  },
};
