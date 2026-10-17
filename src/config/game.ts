/** 可校准训练参数；不代表任何版本的英雄联盟官方数值。单位：世界像素、秒。 */
export const GAME_CONFIG = {
  // 延长道路约 40%，完整地图仍放入参考图比例的固定视窗。
  world: { width: 1540, height: 1100, gridSize: 100, chunkSize: 512 },
  player: {
    spawn: { x: 770, y: 670 }, // 站在交汇点侧后方，留出两队初始交战空间。
    moveSpeed: 195, // 原 325 的 60%。
    collisionRadius: 20,
    turnSpeed: 10, // 弧度 / 秒；反向指令先转身，再前进。
    arrivalDistance: 0.5,
  },
  combat: {
    attackSpeed: 0.9, // 次 / 秒；紧凑训练场参数，均可独立校准。
    windupRatio: 0.28,
    projectileSpeed: 1150,
    attackRange: 300, // 两单位碰撞圆边缘之间的距离。
    attackDamage: 60,
    releaseFeedbackSeconds: 0.045,
    cursorAcquireRadius: 100,
    attackMoveAcquireRadius: 390,
    attackMoveRule: 'nearest-player-while-moving',
  },
  trainingTargets: { maxHealth: 240, armor: 0, collisionRadius: 22, respawnSeconds: 3 },
  simulation: {
    maxStep: 1 / 120,
    maxFrameDelta: 0.1, // 失焦/卡顿后不追赶过期时间，防止跨屏跳跃。
  },
} as const;
