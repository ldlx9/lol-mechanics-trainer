export type SkillshotKind = 'piercing' | 'spear' | 'energy';
export type DodgeDifficulty = 'easy' | 'advanced';

/** 难度只调整来袭频率与容量，不修改弹道速度、伤害或小兵参数。 */
export const DODGE_DIFFICULTIES = {
  easy: { label: '简单', frequencyMultiplier: 1, capacityMultiplier: 1 },
  advanced: { label: '进阶', frequencyMultiplier: 6, capacityMultiplier: 2 },
} as const;
export interface SkillshotConfig {
  speed: number;
  width: number;
  damage: number;
  length: number;
  maxDistance: number;
  maxDamageMultiplier: number;
  damageScaleDistance: number;
}
export interface DodgeConfig {
  firstShotDelay: number;
  interval: number;
  intervalJitter: number;
  spawnMargin: number;
  predictionProbability: number;
  offsetProbability: number;
  randomOffsetRadius: number;
  maxPredictionSeconds: number;
  maxLifetime: number;
  maxActive: number;
  feedbackSeconds: number;
  kinds: Record<SkillshotKind, SkillshotConfig>;
}

/** 原创训练弹道，可校准参数；不代表英雄联盟任何英雄的官方技能数值。 */
export const DODGE_CONFIG: DodgeConfig = {
  firstShotDelay: 2,
  interval: 3,
  intervalJitter: 0.35,
  spawnMargin: 100,
  predictionProbability: 0.4,
  offsetProbability: 0.3,
  randomOffsetRadius: 170,
  maxPredictionSeconds: 2.5,
  maxLifetime: 8,
  maxActive: 12,
  feedbackSeconds: 0.7,
  kinds: {
    piercing: { speed: 620, width: 34, damage: 110, length: 115, maxDistance: 3600, maxDamageMultiplier: 1, damageScaleDistance: 1 },
    spear: { speed: 540, width: 18, damage: 70, length: 85, maxDistance: 3600, maxDamageMultiplier: 2.2, damageScaleDistance: 1600 },
    energy: { speed: 700, width: 24, damage: 90, length: 58, maxDistance: 3600, maxDamageMultiplier: 1, damageScaleDistance: 1 },
  },
};

export const VITALS_CONFIG = {
  maxHealth: 1000,
  invulnerabilitySeconds: 0.65,
  hitFlashSeconds: 0.2,
  recoverSeconds: 2,
  recoveryInvulnerabilitySeconds: 1.2,
};

export type VitalsConfig = typeof VITALS_CONFIG;
