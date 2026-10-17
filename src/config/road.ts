import { GAME_CONFIG } from './game';

/** 地面绘制与小兵导航共用的道路定义，单位为世界像素。 */
export const ROAD_CONFIG = {
  center: { x: GAME_CONFIG.world.width / 2, y: GAME_CONFIG.world.height / 2 },
  slope: 0.58,
  halfWidth: 188,
  edgeInset: 8,
  returnInset: 24,
  shoulderWidth: 450,
  mossWidth: 535,
} as const;
