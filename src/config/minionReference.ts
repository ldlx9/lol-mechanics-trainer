/**
 * 2026-10-17 核对的 16.20 / 26.20 客户端 CharacterRecords/Root 基础字段。
 * 来源为 CommunityDragon 提供的客户端数据提取，不是 Riot 官方参数 API。
 * 不含地图脚本、出生时额外修正和游戏时间成长，不能等同于整局实战数值。
 */
export const MINION_REFERENCE = {
  version: '16.20 / 26.20',
  melee: {
    maxHealth: 430, attackDamage: 11, attackSpeed: 1.25, attackTotalTime: 0.8, attackCastTime: 0.393,
    source: 'https://raw.communitydragon.org/16.20/game/data/characters/sru_orderminionmelee/sru_orderminionmelee.bin.json',
  },
  ranged: {
    maxHealth: 275, attackDamage: 19.5, attackSpeed: 0.667, attackTotalTime: 1.5, attackCastTime: 0.47,
    source: 'https://raw.communitydragon.org/16.20/game/data/characters/sru_orderminionranged/sru_orderminionranged.bin.json',
  },
  cannon: {
    maxHealth: 750, attackDamage: 36, attackSpeed: 1, attackTotalTime: 1, attackCastTime: 0.3,
    source: 'https://raw.communitydragon.org/16.20/game/data/characters/sru_orderminionsiege/sru_orderminionsiege.bin.json',
  },
} as const;
