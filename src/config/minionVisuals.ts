import type { Team } from '../combat/AttackTarget';

export interface MinionVisual {
  key: string;
  url: string;
  anchor: { x: number; y: number };
  sourceHeight: number;
  height: number;
}

const visual = (team: Team, kind: 'melee' | 'ranged', sourceHeight: number, footX: number, footY: number): MinionVisual => ({
  key: `minion-${team}-${kind}`, url: `${import.meta.env.BASE_URL}assets/minions/${team}-${kind}.png`,
  anchor: { x: footX / 1254, y: footY / 1254 }, sourceHeight,
  height: kind === 'melee' ? 48 : 46,
});

/** 单姿势像素素材，朝本地 +X；脚底在单位中心下方 14 世界单位。 */
export const MINION_VISUALS = {
  blue: { melee: visual('blue', 'melee', 658, 670, 971), ranged: visual('blue', 'ranged', 729, 650, 996) },
  red: { melee: visual('red', 'melee', 683, 670, 981), ranged: visual('red', 'ranged', 732, 650, 997) },
} satisfies Record<Team, Record<'melee' | 'ranged', MinionVisual>>;

export const MINION_VISUAL_LIST = Object.values(MINION_VISUALS).flatMap(team => Object.values(team));
