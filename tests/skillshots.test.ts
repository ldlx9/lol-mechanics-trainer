import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { MINION_CONFIG } from '../src/config/minions';
import { DODGE_CONFIG, VITALS_CONFIG } from '../src/config/skillshots';
import type { DodgeConfig, SkillshotKind } from '../src/config/skillshots';
import { PlayerVitals } from '../src/combat/PlayerVitals';
import type { AttackTarget } from '../src/combat/AttackTarget';
import { Minion } from '../src/minions/Minion';
import { Movement } from '../src/simulation/Movement';
import { insideRect, sweptCircleTime } from '../src/simulation/geometry';
import type { ViewRect } from '../src/simulation/geometry';
import { LaneTraining } from '../src/minions/LaneTraining';
import { interceptTime, SHOT_DIRECTIONS, SkillshotSystem } from '../src/skillshots/SkillshotSystem';

const view: ViewRect = { x: 0, y: 0, width: 1000, height: 1000 };
function setup(overrides: Partial<DodgeConfig> = {}, random = () => 0.99, minions: AttackTarget[] = []) {
  const config = { ...structuredClone(DODGE_CONFIG), firstShotDelay: 999, ...overrides };
  const motion = new Movement({ x: 500, y: 500 }, GAME_CONFIG.player, { width: 1000, height: 1000 });
  const vitals = new PlayerVitals({ ...VITALS_CONFIG });
  const skills = new SkillshotSystem(motion, minions, vitals, config, random);
  return { motion, vitals, skills, config };
}
function advance(sim: ReturnType<typeof setup>, seconds: number, rect = view) {
  const frames = Math.round(seconds * 120);
  for (let i = 0; i < frames; i++) { sim.motion.step(1 / 120); sim.skills.step(1 / 120, rect); }
}
function minion(id: string, x: number, team: 'blue' | 'red' = 'blue') {
  return new Minion(id, team, 'melee', 1, { x, y: 500 }, { x, y: 500 },
    { ...MINION_CONFIG.stats.melee, maxHealth: 1000, moveSpeed: 0 }, { width: 1000, height: 1000 }, () => undefined);
}

describe('八方向屏外生成和固定轨迹', () => {
  it.each(SHOT_DIRECTIONS.map((side, index) => [side.name, index] as const))('%s 的全部三种弹道都在当前视窗外生成', (_name, directionIndex) => {
    const sim = setup();
    for (const rect of [view, { x: 100, y: 200, width: 700, height: 600 }, { x: -500, y: -200, width: 2000, height: 1400 }]) {
      for (const kind of ['piercing', 'spear', 'energy'] as const) {
        const p = sim.skills.fire(rect, { kind, directionIndex })!;
        const spec = sim.config.kinds[kind];
        expect(insideRect(p, rect, spec.width + 12)).toBe(false);
        expect(p.sourceDirection).toBe(SHOT_DIRECTIONS[directionIndex].name);
        sim.skills.projectiles = [];
      }
    }
  });

  it('玩家靠近边缘时，发射点仍越过屏幕边界而非只越过玩家附近', () => {
    const sim = setup();
    sim.motion.x = 20; sim.motion.y = 980;
    for (let i = 0; i < 8; i++) {
      const p = sim.skills.fire(view, { kind: 'piercing', directionIndex: i })!;
      expect(insideRect(p, view, 50)).toBe(false);
    }
  });

  it('正确计算匀速预测拦截，并限制最长预测时间', () => {
    expect(interceptTime({ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 195, y: 0 }, 700, 5)).toBeCloseTo(500 / (700 - 195));
    expect(interceptTime({ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 195, y: 0 }, 700, 2)).toBe(2);
    const sim = setup({}, () => 0.1);
    sim.motion.velocity = { x: 100, y: 0 };
    const p = sim.skills.fire(view, { kind: 'energy', directionIndex: 6 })!;
    expect(p.aimMode).toBe('predicted');
    expect(p.aimPoint.x).toBeGreaterThan(sim.motion.x);
  });

  it('当前位置、速度预测、随机偏移均由独立概率选择', () => {
    for (const [random, mode] of [[0.1, 'predicted'], [0.5, 'offset'], [0.9, 'current']] as const) {
      const sim = setup({}, () => random);
      const p = sim.skills.fire(view, { kind: 'energy', directionIndex: 0 })!;
      expect(p.aimMode).toBe(mode);
      if (mode === 'offset') {
        const distance = Math.hypot(p.aimPoint.x - sim.motion.x, p.aimPoint.y - sim.motion.y);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThanOrEqual(sim.config.randomOffsetRadius);
      }
    }
  });

  it('玩家转向和视窗改变都不会让已经发射的弹道追踪或改变速度', () => {
    const sim = setup();
    const p = sim.skills.fire(view, { kind: 'energy', directionIndex: 6 })!;
    const direction = { ...p.direction };
    const origin = { ...p };
    sim.motion.heading = Math.PI / 2;
    sim.motion.moveTo({ x: 500, y: 900 });
    advance(sim, 0.5, { x: -200, y: -100, width: 1400, height: 1200 });
    expect(p.direction).toEqual(direction);
    expect(p.x - origin.x).toBeCloseTo(direction.x * sim.config.kinds.energy.speed * 0.5);
    expect(p.y - origin.y).toBeCloseTo(direction.y * sim.config.kinds.energy.speed * 0.5);
  });
});

describe('连续碰撞、穿透与挡弹', () => {
  it('两个运动圆在一帧中相交，即使帧首和帧末都不重叠也命中', () => {
    expect(sweptCircleTime({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: -100 }, { x: 0, y: 100 }, 2)).toBeCloseTo(0.493, 2);
    expect(sweptCircleTime({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }, { x: 0, y: 50 }, 2)).toBeNull();
  });

  it('高速弹道跨过整名玩家也不会漏判', () => {
    const sim = setup();
    sim.config.kinds.energy.speed = 100000;
    sim.skills.fire(view, { kind: 'energy', directionIndex: 6 });
    advance(sim, 0.02);
    expect(sim.skills.stats.hits).toBe(1);
    expect(sim.vitals.health).toBe(910);
    expect(sim.skills.projectiles).toHaveLength(0);
  });

  it('穿透弹击中多个蓝方单位与玩家，每个目标只受一次伤害，红兵不挡弹', () => {
    const blue1 = minion('blue1', 200); const blue2 = minion('blue2', 400); const red = minion('red', 100, 'red');
    const sim = setup({}, undefined, [blue1, blue2, red]);
    sim.skills.fire(view, { kind: 'piercing', directionIndex: 6 });
    advance(sim, 4);
    expect([blue1.health, blue2.health, sim.vitals.health]).toEqual([890, 890, 890]);
    expect(red.health).toBe(1000);
    expect(sim.skills.stats.hits).toBe(1);
    expect(sim.skills.stats.blocked).toBe(0);
    expect(sim.skills.stats.dodges).toBe(0);
  });

  it.each(['spear', 'energy'] as const)('%s 按接触先后命中首个蓝兵，不按目标数组顺序命中玩家', kind => {
    const front = minion('front', 200); const back = minion('back', 400); const red = minion('red', 100, 'red');
    const sim = setup({}, undefined, [back, red, front]);
    sim.config.kinds[kind].speed = 100000;
    sim.skills.fire(view, { kind, directionIndex: 6 });
    advance(sim, 0.02);
    expect(front.health).toBeLessThan(1000);
    expect(back.health).toBe(1000);
    expect(red.health).toBe(1000);
    expect(sim.vitals.health).toBe(1000);
    expect(sim.skills.stats.blocked).toBe(1);
    expect(sim.skills.stats.hits).toBe(0);
    expect(sim.skills.stats.dodges).toBe(0);
    expect(sim.skills.projectiles).toHaveLength(0);
  });

  it('长矛实际飞行越远伤害越高，并受最大倍率限制', () => {
    const damages = [view, { x: -1000, y: 0, width: 2000, height: 1000 }].map(rect => {
      const sim = setup();
      sim.skills.fire(rect, { kind: 'spear', directionIndex: 6 });
      advance(sim, 4, rect);
      expect(sim.skills.stats.hits).toBe(1);
      return 1000 - sim.vitals.health;
    });
    expect(damages[1]).toBeGreaterThan(damages[0]);
    expect(damages[1]).toBeLessThanOrEqual(DODGE_CONFIG.kinds.spear.damage * DODGE_CONFIG.kinds.spear.maxDamageMultiplier);
  });

  it('红方技能击杀蓝兵只计真实死亡，不增加玩家 CS 或漏刀', () => {
    const config = structuredClone(MINION_CONFIG);
    config.acquireRange = 0;
    for (const spec of Object.values(config.stats)) spec.moveSpeed = 0;
    const motion = new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world);
    const lane = new LaneTraining(motion, config, GAME_CONFIG.combat);
    const skills = new SkillshotSystem(motion, lane.lane.minions, new PlayerVitals({ ...VITALS_CONFIG }), { ...DODGE_CONFIG, firstShotDelay: 999 });
    const rect = { x: 0, y: 0, ...GAME_CONFIG.world };
    for (let i = 0; i < 60; i++) lane.update(1 / 120, dt => skills.step(dt, rect));
    const blue = lane.lane.minions.find(m => m.team === 'blue')!;
    blue.x = 500; blue.y = motion.y; blue.health = 30;
    // 这个用例验证正面挡弹和死亡归属，锁定目标，避免随机偏移造成偶发空弹。
    skills.fire(rect, { kind: 'energy', directionIndex: 6, target: motion });
    for (let i = 0; i < 240; i++) lane.update(1 / 120, dt => skills.step(dt, rect));
    expect(blue.alive).toBe(false);
    expect(lane.lane.stats.totalDeaths).toBe(1);
    expect(lane.lane.stats.cs).toBe(0);
    expect(lane.lane.stats.missed).toBe(0);
    expect(skills.stats.blocked).toBe(1);
    expect(skills.vitals.health).toBe(1000);
  });
});

describe('命中威胁与有效躲避统计', () => {
  it('正面威胁入屏后走位躲开才增加有效躲避', () => {
    const sim = setup();
    sim.skills.fire(view, { kind: 'piercing', directionIndex: 6 });
    advance(sim, 0.4);
    expect(sim.skills.stats.threats).toBe(1);
    sim.motion.heading = Math.PI / 2;
    sim.motion.moveTo({ x: 500, y: 900 });
    advance(sim, 4);
    expect(sim.skills.stats.hits).toBe(0);
    expect(sim.skills.stats.dodges).toBe(1);
  });

  it('随机打偏后自然飞出，不增加躲避数', () => {
    const sim = setup();
    sim.skills.fire(view, { kind: 'piercing', directionIndex: 6, target: { x: 500, y: 50 } });
    advance(sim, 5);
    expect(sim.skills.stats.threats).toBe(0);
    expect(sim.skills.stats.dodges).toBe(0);
    expect(sim.skills.stats.harmlessMisses).toBe(1);
  });

  it('保持入屏时的行军速度本来就不会中弹，不虚增躲避', () => {
    const sim = setup();
    sim.motion.heading = Math.PI / 2;
    sim.motion.moveTo({ x: 500, y: 950 });
    sim.skills.fire(view, { kind: 'piercing', directionIndex: 6 });
    advance(sim, 4);
    expect(sim.skills.stats.hits).toBe(0);
    expect(sim.skills.stats.threats).toBe(0);
    expect(sim.skills.stats.dodges).toBe(0);
  });

  it('已构成威胁但随后被小兵挡下，不算玩家躲避', () => {
    const blocker = minion('blocker', 300);
    blocker.y = 100;
    const sim = setup({}, undefined, [blocker]);
    sim.skills.fire(view, { kind: 'energy', directionIndex: 6 });
    advance(sim, 0.3);
    expect(sim.skills.stats.threats).toBe(1);
    blocker.y = 500;
    advance(sim, 3);
    expect(sim.skills.stats.blocked).toBe(1);
    expect(sim.skills.stats.dodges).toBe(0);
    expect(sim.skills.stats.hits).toBe(0);
  });

  it('无敌帧挡下重叠弹道，不重复扣血，也不当作躲避', () => {
    const sim = setup();
    for (let i = 0; i < 2; i++) sim.skills.fire(view, { kind: 'piercing', directionIndex: 6 });
    advance(sim, 4);
    expect(sim.vitals.health).toBe(890);
    expect(sim.skills.stats.hits).toBe(1);
    expect(sim.skills.stats.protectedContacts).toBe(1);
    expect(sim.skills.stats.dodges).toBe(0);
  });

  it('主动清理弹道不结算躲避，重新开启后按间隔发射', () => {
    const sim = setup({ firstShotDelay: 0.1, interval: 3, intervalJitter: 0 });
    advance(sim, 0.5);
    expect(sim.skills.stats.fired).toBe(1);
    sim.skills.setEnabled(false);
    expect(sim.skills.projectiles).toHaveLength(0);
    advance(sim, 2);
    expect(sim.skills.stats.dodges).toBe(0);
    expect(sim.skills.stats.fired).toBe(1);
    sim.skills.setEnabled(true);
    advance(sim, 0.1);
    expect(sim.skills.stats.fired).toBe(2);
  });
});

describe('简单与进阶难度', () => {
  it('默认简单，进阶在相同时间内提供六倍发射频率', () => {
    const easy = setup({ firstShotDelay: 2, intervalJitter: 0 });
    const advanced = setup({ firstShotDelay: 2, intervalJitter: 0 });
    expect(easy.skills.difficulty).toBe('easy');
    expect(easy.skills.shotInterval).toBe(3);
    advanced.skills.setDifficulty('advanced');
    expect(advanced.skills.shotInterval).toBe(0.5);
    advance(easy, 30);
    advance(advanced, 30);
    expect(easy.skills.stats.fired).toBe(10);
    expect(advanced.skills.stats.fired).toBe(60);
    expect(advanced.skills.maxActive).toBe(24);
  });

  it('切换立即缩短下一发等待，但保留现有弹道、血量和统计', () => {
    const sim = setup({ firstShotDelay: 0.1, intervalJitter: 0 });
    advance(sim, 0.4);
    const projectile = sim.skills.projectiles[0];
    const stats = { ...sim.skills.stats };
    const health = sim.vitals.health;
    const now = sim.skills.time;
    sim.skills.setDifficulty('advanced');
    expect(sim.skills.projectiles[0]).toBe(projectile);
    expect({ ...sim.skills.stats }).toEqual(stats);
    expect(sim.vitals.health).toBe(health);
    expect(sim.skills.time).toBe(now);
    expect(sim.skills.untilNextShot).toBeCloseTo(0.45);
    advance(sim, 0.5);
    expect(sim.skills.stats.fired).toBe(2);
    expect(sim.config.kinds).toEqual(DODGE_CONFIG.kinds);
  });

  it('回到简单后下一发和后续发射变慢，不补发积压弹道', () => {
    const sim = setup({ firstShotDelay: 2, intervalJitter: 0 });
    sim.skills.setDifficulty('advanced');
    advance(sim, 1);
    const fired = sim.skills.stats.fired;
    sim.skills.setDifficulty('easy');
    expect(sim.skills.untilNextShot).toBeCloseTo(2);
    advance(sim, 1.5);
    expect(sim.skills.stats.fired).toBe(fired);
    advance(sim, 0.5);
    expect(sim.skills.stats.fired).toBe(fired + 1);
    expect(sim.skills.untilNextShot).toBeCloseTo(3);
  });

  it('重复选择同一难度不重置冷却', () => {
    const sim = setup({ firstShotDelay: 2, intervalJitter: 0 });
    sim.skills.setDifficulty('advanced');
    advance(sim, 0.2);
    const nextShotAt = sim.skills.nextShotAt;
    for (let i = 0; i < 10; i++) sim.skills.setDifficulty('advanced');
    expect(sim.skills.nextShotAt).toBe(nextShotAt);
  });

  it('切换难度不改变关闭状态，重新启用采用进阶频率', () => {
    const sim = setup({ firstShotDelay: 2, intervalJitter: 0 });
    sim.skills.setEnabled(false);
    sim.skills.setDifficulty('advanced');
    advance(sim, 3);
    expect(sim.skills.enabled).toBe(false);
    expect(sim.skills.stats.fired).toBe(0);
    sim.skills.setEnabled(true);
    advance(sim, 0.3);
    expect(sim.skills.stats.fired).toBe(0);
    advance(sim, 0.05);
    expect(sim.skills.stats.fired).toBe(1);
  });
});

describe('生命、时间步及长时间运行', () => {
  it('受击有独立无敌帧，生命归零后自动恢复并保留统计', () => {
    const vitals = new PlayerVitals({ ...VITALS_CONFIG });
    expect(vitals.receiveDamage(100)).toBe(100);
    expect(vitals.receiveDamage(100)).toBe(0);
    vitals.step(0.65);
    expect(vitals.receiveDamage(1000)).toBe(900);
    expect(vitals.health).toBe(0);
    vitals.step(1.99);
    expect(vitals.health).toBe(0);
    vitals.step(0.01);
    expect(vitals.health).toBe(1000);
    expect(vitals.recoveries).toBe(1);
    expect(vitals.receiveDamage(100)).toBe(0);
    vitals.step(1.2);
    expect(vitals.receiveDamage(100)).toBe(100);
  });

  it.each(['easy', 'advanced'] as const)('%s 难度在 30/60/120/144 FPS 的移动、兵线、随机发射、血量与躲避结果完全一致', difficulty => {
    const results = [30, 60, 120, 144].map(fps => {
      let seed = 42;
      const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
      const motion = new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world);
      const lane = new LaneTraining(motion, MINION_CONFIG, GAME_CONFIG.combat);
      const skills = new SkillshotSystem(motion, lane.lane.minions, new PlayerVitals({ ...VITALS_CONFIG }), DODGE_CONFIG, random);
      skills.setDifficulty(difficulty);
      lane.combat.moveTo({ x: 1200, y: 750 });
      const rect = { x: 0, y: 0, ...GAME_CONFIG.world };
      for (let i = 0; i < fps * 40; i++) lane.update(1 / fps, dt => skills.step(dt, rect));
      expect(skills.stats.fired).toBeGreaterThan(10);
      return { player: { x: motion.x, y: motion.y, health: skills.vitals.health }, stats: { ...skills.stats },
        lane: lane.lane.minions.map(m => ({ id: m.id, x: m.x, y: m.y, health: m.health })),
        shots: skills.projectiles.map(p => ({ id: p.id, kind: p.kind, x: p.x, y: p.y })) };
    });
    for (const result of results) expect(result).toEqual(results[0]);
  });

  it('持续密集发射也会回收弹道与特效，单位数量有界', () => {
    const sim = setup({ firstShotDelay: 0.1, interval: 0.25, intervalJitter: 0 });
    advance(sim, 90);
    expect(sim.skills.stats.fired).toBeGreaterThan(100);
    expect(sim.skills.projectiles.length).toBeLessThanOrEqual(sim.config.maxActive);
    expect(sim.skills.impacts.length).toBeLessThanOrEqual(48);
    for (const p of sim.skills.projectiles) expect(Number.isFinite(p.x + p.y)).toBe(true);
  });

  it.each(['piercing', 'spear', 'energy'] as SkillshotKind[])('%s 命中玩家后不改变玩家移动目的地和速度配置', kind => {
    const sim = setup();
    sim.motion.moveTo({ x: 500, y: 500 });
    sim.skills.fire(view, { kind, directionIndex: 6 });
    advance(sim, 2);
    expect(sim.skills.stats.hits).toBe(1);
    expect(sim.motion.x).toBe(500);
    expect(sim.motion.y).toBe(500);
    expect(sim.motion.config.moveSpeed).toBe(195);
  });
});
