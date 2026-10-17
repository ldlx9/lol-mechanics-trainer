import type { Point } from '../simulation/Movement';
import { ROAD_CONFIG } from './road';
import { MINION_REFERENCE as REF } from './minionReference';

/** 训练攻速倍率：1 为参考基础攻速，0.5 为半速；不修改参考记录本身。 */
export const MINION_ATTACK_SPEED_SCALE = 0.5;

export type MinionKind = 'melee' | 'ranged' | 'cannon';
export interface MinionStats {
  maxHealth: number;
  attackDamage: number;
  attackInterval: number; // 秒/次，与参考攻速（次/秒）互为倒数。
  windupRatio: number;
  attackRange: number;
  moveSpeed: number;
  armor: number;
  collisionRadius: number;
  projectileSpeed: number;
  bonusCurrentHealthRatio: number;
  healthGrowth: number;
  damageGrowth: number;
}
export interface LaneConfig {
  firstWaveDelay: number;
  waveInterval: number;
  meleePerWave: number;
  rangedPerWave: number;
  cannonEveryWaves: number;
  firstCannonWave: number;
  growthInterval: number;
  acquireRange: number;
  leashRange: number;
  queueSpacing: number;
  meleeFormationSpacing: number;
  meleeApproachDistance: number;
  frontSpawnDistance: number;
  routeEndDistance: number;
  slope: number;
  center: Point;
  roadHalfWidth: number;
  roadEdgeInset: number;
  roadReturnInset: number;
  deathSeconds: number;
  exitWaitSeconds: number;
  exitRadius: number;
  separationSpeed: number;
  separationPasses: number;
  maxActiveMinions: number;
  stats: Record<MinionKind, MinionStats>;
}

/** 可校准参数：参考普通召唤师峡谷早期兵线结构，非官方全版本精确复刻。
 * 参考与差异见 README。队列从近战到远程、炮车沿道路依次排列。
 */
export const MINION_CONFIG: LaneConfig = {
  firstWaveDelay: 0.5,
  waveInterval: 30,
  meleePerWave: 3,
  rangedPerWave: 3,
  cannonEveryWaves: 3,
  firstCannonWave: 3,
  growthInterval: 90,
  acquireRange: 360,
  leashRange: 560,
  queueSpacing: 48,
  meleeFormationSpacing: 38,
  meleeApproachDistance: 28,
  frontSpawnDistance: 500,
  routeEndDistance: 820,
  slope: ROAD_CONFIG.slope,
  center: ROAD_CONFIG.center,
  roadHalfWidth: ROAD_CONFIG.halfWidth,
  roadEdgeInset: ROAD_CONFIG.edgeInset,
  roadReturnInset: ROAD_CONFIG.returnInset,
  deathSeconds: 0.9,
  exitWaitSeconds: 0.4,
  exitRadius: 42,
  separationSpeed: 240,
  separationPasses: 3,
  maxActiveMinions: 120,
  stats: {
    melee: { maxHealth: REF.melee.maxHealth, attackDamage: REF.melee.attackDamage, attackInterval: 1 / (REF.melee.attackSpeed * MINION_ATTACK_SPEED_SCALE),
      windupRatio: REF.melee.attackCastTime / REF.melee.attackTotalTime, attackRange: 28, moveSpeed: 55.5, armor: 0,
      collisionRadius: 16, projectileSpeed: 0, bonusCurrentHealthRatio: 0.02, healthGrowth: 35, damageGrowth: 0.5 },
    ranged: { maxHealth: REF.ranged.maxHealth, attackDamage: REF.ranged.attackDamage, attackInterval: 1 / (REF.ranged.attackSpeed * MINION_ATTACK_SPEED_SCALE),
      windupRatio: REF.ranged.attackCastTime / REF.ranged.attackTotalTime, attackRange: 225, moveSpeed: 55.5, armor: 0,
      collisionRadius: 14, projectileSpeed: 650, bonusCurrentHealthRatio: 0.035, healthGrowth: 9, damageGrowth: 1.5 },
    cannon: { maxHealth: REF.cannon.maxHealth, attackDamage: REF.cannon.attackDamage, attackInterval: 1 / (REF.cannon.attackSpeed * MINION_ATTACK_SPEED_SCALE),
      windupRatio: REF.cannon.attackCastTime / REF.cannon.attackTotalTime, attackRange: 260, moveSpeed: 52.5, armor: 5,
      collisionRadius: 21, projectileSpeed: 780, bonusCurrentHealthRatio: 0.05, healthGrowth: 85, damageGrowth: 1.5 },
  },
};
