export interface PlayerFrame {
  key: string;
  url: string;
  /** 原图脚底锚点；跑步循环共用，避免切帧位移。 */
  anchor: { x: number; y: number };
  sourceHeight: number;
}

const runFrame = (suffix: string): PlayerFrame => ({
  key: `player-run${suffix}`, url: `/assets/character/move-simple${suffix}.png`,
  anchor: { x: 650 / 1254, y: 1085 / 1254 }, sourceHeight: 846,
});

export const PLAYER_FRAMES = {
  idle: {
    key: 'player-idle', url: '/assets/character/idle-simple.png',
    anchor: { x: 610 / 1254, y: 1092 / 1254 }, sourceHeight: 924,
  },
  windup: {
    key: 'player-windup', url: '/assets/character/windup-simple.png',
    anchor: { x: 650 / 1254, y: 1060 / 1254 }, sourceHeight: 874,
  },
  run1: runFrame(''), run2: runFrame('-02'), run3: runFrame('-03'),
  run4: runFrame('-04'), run5: runFrame('-05'),
} satisfies Record<string, PlayerFrame>;

export type PlayerFrameName = keyof typeof PLAYER_FRAMES;

export const PLAYER_VISUAL_CONFIG = {
  height: 86, // 仅调整画面，不改变判定半径或移动参数。
  runFrameSeconds: 0.07,
  runSequence: ['run1', 'run4', 'run2', 'run5', 'run3', 'run5', 'run2', 'run4'] as readonly PlayerFrameName[],
};
