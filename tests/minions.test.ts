import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { MINION_CONFIG, MINION_ATTACK_SPEED_SCALE } from '../src/config/minions';
import type { LaneConfig, MinionStats } from '../src/config/minions';
import { Movement } from '../src/simulation/Movement';
import { LaneTraining } from '../src/minions/LaneTraining';
import { LastHitStats } from '../src/stats/LastHitStats';
import { Minion } from '../src/minions/Minion';
import { MINION_REFERENCE } from '../src/config/minionReference';

const playerSource = { id: 'player', team: 'blue', kind: 'player' } as const;
const blueSource = { id: 'blue-minion', team: 'blue', kind: 'minion' } as const;
const redSource = { id: 'red-minion', team: 'red', kind: 'minion' } as const;

function training(overrides: Partial<LaneConfig> = {}, statOverrides: Partial<MinionStats> = {}): LaneTraining {
  const config = structuredClone(MINION_CONFIG);
  Object.assign(config, overrides);
  for (const stats of Object.values(config.stats)) Object.assign(stats, statOverrides);
  return new LaneTraining(new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world), config, GAME_CONFIG.combat);
}

function advance(sim: LaneTraining, seconds: number, fps = 60): void {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) sim.update(seconds / frames);
}

describe('兵线波次与生命周期', () => {
  it('上线时是近战在前、远程在后的单列，接敌前不肩并肩展开', () => {
    const sim = training();
    advance(sim, 2.5);
    const { center, slope } = MINION_CONFIG;
    const length = Math.hypot(1, slope);
    const forward = { x: 1 / length, y: -slope / length };
    for (const team of ['blue', 'red'] as const) {
      const queue = sim.lane.minions.filter(m => m.team === team);
      expect(queue.map(m => m.kind)).toEqual(['melee', 'melee', 'melee', 'ranged', 'ranged', 'ranged']);
      const sign = team === 'blue' ? 1 : -1;
      const progress = queue.map(m => ((m.x - center.x) * forward.x + (m.y - center.y) * forward.y) * sign);
      for (let i = 0; i < queue.length; i++) {
        const m = queue[i];
        expect(Math.abs(-(m.x - center.x) * forward.y + (m.y - center.y) * forward.x)).toBeLessThan(0.01);
        if (i > 0) expect(progress[i - 1] - progress[i]).toBeCloseTo(MINION_CONFIG.queueSpacing, 2);
      }
    }
  });

  it('正常兵线行军后在中央接敌，近战挥击且远程在距离外发射', () => {
    const sim = training({ waveInterval: 999 });
    let sawMelee = false;
    let sawRanged = false;
    for (let i = 0; i < 60 * 120; i++) {
      sim.update(1 / 120);
      const effect = sim.lane.meleeEffects[0];
      if (effect && !sawMelee) {
        sawMelee = true;
        expect(Math.hypot(effect.x - MINION_CONFIG.center.x, effect.y - MINION_CONFIG.center.y)).toBeLessThan(220);
      }
      for (const p of sim.lane.projectiles) {
        const source = sim.lane.minions.find(m => m.id === p.source.id);
        const target = sim.lane.minions.find(m => m.id === p.targetId);
        if (source?.kind === 'ranged' && target && Math.hypot(source.x - target.x, source.y - target.y) > 100) sawRanged = true;
      }
    }
    expect(sawMelee).toBe(true);
    expect(sawRanged).toBe(true);
    expect(sim.lane.stats.totalDeaths).toBeGreaterThan(0);
  });

  it('默认每 30 秒一波，每方 3 近战 3 远程，第三波才加炮车', () => {
    const sim = training();
    advance(sim, 0.5);
    expect(sim.lane.wave).toBe(1);
    expect(sim.lane.untilNextWave).toBeCloseTo(30);
    for (const team of ['blue', 'red']) {
      expect(sim.lane.minions.filter(m => m.team === team && m.kind === 'melee')).toHaveLength(3);
      expect(sim.lane.minions.filter(m => m.team === team && m.kind === 'ranged')).toHaveLength(3);
    }
    expect(sim.lane.isCannonWave(1)).toBe(false);
    expect(sim.lane.isCannonWave(2)).toBe(false);
    expect(sim.lane.isCannonWave(3)).toBe(true);
    advance(sim, 30);
    expect(sim.lane.wave).toBe(2);
    advance(sim, 30);
    expect(sim.lane.wave).toBe(3);
    expect(sim.lane.minions.filter(m => m.wave === 3 && m.kind === 'cannon')).toHaveLength(2);
    expect(sim.lane.minions.filter(m => m.wave === 3)).toHaveLength(14);
  });

  it('推进终点被限制在世界内，蓝方幸存兵正常离场且不计死亡', () => {
    const sim = training({ waveInterval: 999 });
    advance(sim, 0.5);
    for (const minion of sim.lane.minions) {
      expect(minion.destination.x).toBeGreaterThanOrEqual(minion.collisionRadius);
      expect(minion.destination.x).toBeLessThanOrEqual(GAME_CONFIG.world.width - minion.collisionRadius);
      if (minion.team === 'red') minion.receiveDamage(100000, playerSource);
    }
    expect(sim.lane.stats.cs).toBe(6);
    advance(sim, 40);
    expect(sim.lane.minions).toHaveLength(0);
    expect(sim.lane.stats.totalDeaths).toBe(6);
    expect(sim.lane.stats.missed).toBe(0);
  });

  it('90 秒后的新波次使用独立的血量和攻击力成长参数', () => {
    const sim = training();
    advance(sim, 90.5);
    expect(sim.lane.wave).toBe(4);
    const melee = sim.lane.minions.find(m => m.wave === 4 && m.kind === 'melee')!;
    expect(melee.stats.maxHealth).toBe(MINION_CONFIG.stats.melee.maxHealth + MINION_CONFIG.stats.melee.healthGrowth);
    expect(melee.stats.attackDamage).toBe(MINION_CONFIG.stats.melee.attackDamage + MINION_CONFIG.stats.melee.damageGrowth);
  });

  it('长时间无玩家操作仍自行交战、清理死亡对象，不产生无界堆积', () => {
    const sim = training();
    advance(sim, 120);
    expect(sim.lane.wave).toBe(4);
    expect(sim.lane.stats.totalDeaths).toBeGreaterThan(20);
    expect(sim.lane.stats.missed).toBeGreaterThan(0);
    expect(sim.lane.stats.cs).toBe(0);
    expect(sim.lane.minions.length).toBeLessThan(60);
    expect(new Set(sim.lane.minions.map(m => m.id)).size).toBe(sim.lane.minions.length);
    for (const minion of sim.lane.minions) {
      expect(Number.isFinite(minion.x + minion.y)).toBe(true);
      expect(minion.x).toBeGreaterThanOrEqual(minion.collisionRadius);
      expect(minion.x).toBeLessThanOrEqual(GAME_CONFIG.world.width - minion.collisionRadius);
      expect(minion.y).toBeGreaterThanOrEqual(minion.collisionRadius);
      expect(minion.y).toBeLessThanOrEqual(GAME_CONFIG.world.height - minion.collisionRadius);
    }
  });
});

describe('小兵攻击与碰撞', () => {
  it.each(['melee', 'ranged', 'cannon'] as const)('%s 真实发射节奏遵守训练攻速倍率，前摇不会导致重复连发', kind => {
    const ref = MINION_REFERENCE[kind];
    const stats = MINION_CONFIG.stats[kind];
    const minion = new Minion('blue-test', 'blue', kind, 1, { x: 300, y: 300 }, { x: 300, y: 300 }, stats, GAME_CONFIG.world, () => undefined);
    const releases: number[] = [];
    for (let i = 0; i < 2400; i++) {
      if (minion.attack.canStart) minion.attack.start({ id: 'fixed-target', generation: 0 });
      if (minion.attack.advance(1 / 120)) releases.push(minion.attack.now);
    }
    expect(minion.health).toBe(ref.maxHealth);
    const expectedSpeed = ref.attackSpeed * MINION_ATTACK_SPEED_SCALE;
    expect(minion.attack.config.attackSpeed).toBeCloseTo(expectedSpeed, 9);
    expect(releases.length).toBeGreaterThan(5);
    expect(releases[0]).toBeGreaterThanOrEqual(minion.attack.windupSeconds - 1e-9);
    expect(releases[0]).toBeLessThan(minion.attack.windupSeconds + 1 / 120 + 1e-9);
    for (let i = 1; i < releases.length; i++) {
      expect(releases[i] - releases[i - 1]).toBeGreaterThanOrEqual(1 / expectedSpeed - 1e-9);
      expect(releases[i] - releases[i - 1]).toBeLessThan(1 / expectedSpeed + 1 / 120 + 1e-9);
    }
  });

  it.each(['blue', 'red'] as const)('玩家直接穿过 %s 方小兵，不阻挡也不推走任何小兵', team => {
    const sim = training({ acquireRange: 0 }, { moveSpeed: 0 });
    advance(sim, 0.5);
    const minion = sim.lane.minions.find(m => m.team === team)!;
    const positions = sim.lane.minions.map(m => ({ id: m.id, x: m.x, y: m.y }));
    sim.motion.x = minion.x - 100;
    sim.motion.y = minion.y;
    sim.motion.heading = 0;
    const destination = { x: minion.x + 100, y: minion.y };
    sim.combat.moveTo(destination);
    advance(sim, 2);
    expect(Math.hypot(sim.motion.x - destination.x, sim.motion.y - destination.y)).toBeLessThanOrEqual(0.5);
    expect(sim.motion.target).toBeNull();
    expect(sim.lane.minions.map(m => ({ id: m.id, x: m.x, y: m.y }))).toEqual(positions);
  });

  it('玩家站在小兵身上，不影响双方行军、交战和伤害结果', () => {
    const overlapping = training();
    const control = training();
    advance(overlapping, 0.5);
    advance(control, 0.5);
    const minion = overlapping.lane.minions[0];
    overlapping.motion.x = minion.x;
    overlapping.motion.y = minion.y;
    advance(overlapping, 48);
    advance(control, 48);
    const result = (sim: LaneTraining) => ({
      units: sim.lane.minions.map(m => ({ id: m.id, x: m.x, y: m.y, health: m.health })),
      deaths: sim.lane.stats.totalDeaths,
      missed: sim.lane.stats.missed,
    });
    expect(result(overlapping)).toEqual(result(control));
    expect(overlapping.lane.stats.totalDeaths).toBeGreaterThan(0);
  });

  it('近战兵使用近距离攻击，不创建飞行弹道', () => {
    const sim = training({ rangedPerWave: 0, firstCannonWave: 99, frontSpawnDistance: 80, firstWaveDelay: 0.01 });
    let sawSwing = false;
    for (let i = 0; i < 480; i++) { sim.update(1 / 120); sawSwing ||= sim.lane.meleeEffects.length > 0; }
    expect(sawSwing).toBe(true);
    expect(sim.lane.projectiles).toHaveLength(0);
    expect(sim.lane.minions.some(m => m.health < m.stats.maxHealth)).toBe(true);
  });

  it('远程兵和炮车确实发射弹道，命中后扣血且只寻找敌方小兵', () => {
    const sim = training({ frontSpawnDistance: 30, queueSpacing: 34, firstWaveDelay: 0.01, firstCannonWave: 1 }, { moveSpeed: 0 });
    const firedKinds = new Set<string>();
    for (let i = 0; i < 240; i++) {
      sim.update(1 / 120);
      for (const projectile of sim.lane.projectiles) {
        const source = sim.lane.minions.find(m => m.id === projectile.source.id)!;
        const target = sim.lane.minions.find(m => m.id === projectile.targetId)!;
        firedKinds.add(source.kind);
        expect(target.team).not.toBe(source.team);
      }
    }
    expect(firedKinds.has('ranged')).toBe(true);
    expect(firedKinds.has('cannon')).toBe(true);
    expect(sim.lane.minions.some(m => m.health < m.stats.maxHealth)).toBe(true);
  });

  it('已经发射的远程弹道在发射者死亡后仍然可以命中', () => {
    const sim = training({ frontSpawnDistance: 30, queueSpacing: 34, firstWaveDelay: 0.01 }, { moveSpeed: 0, projectileSpeed: 50 });
    let projectile = sim.lane.projectiles[0];
    for (let i = 0; i < 120 && !projectile; i++) { sim.update(1 / 120); projectile = sim.lane.projectiles[0]; }
    expect(projectile).toBeDefined();
    const source = sim.lane.minions.find(m => m.id === projectile.source.id)!;
    const victim = sim.lane.minions.find(m => m.id === projectile.targetId)!;
    const health = victim.health;
    source.receiveDamage(100000, source.team === 'blue' ? redSource : blueSource);
    advance(sim, 5);
    expect(victim.health).toBeLessThan(health);
  });

  it('重叠单位按 dt 柔和分离，不瞬间远距离移动', () => {
    const sim = training({ acquireRange: 0 }, { moveSpeed: 0 });
    advance(sim, 0.5);
    const [a, b] = sim.lane.minions;
    const { x, y } = MINION_CONFIG.center;
    a.x = b.x = x; a.y = b.y = y;
    sim.update(1 / 120);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0);
    expect(Math.hypot(a.x - x, a.y - y)).toBeLessThanOrEqual(6.0001);
    advance(sim, 0.5);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.collisionRadius + b.collisionRadius - 0.1);
  });

  it('炮车护甲实际减少玩家普攻伤害', () => {
    const sim = training({ firstCannonWave: 1 });
    advance(sim, 0.5);
    const cannon = sim.lane.minions.find(m => m.kind === 'cannon' && m.team === 'red')!;
    const damage = cannon.receiveDamage(60, playerSource);
    expect(damage).toBeCloseTo(60 * 100 / 105);
  });
});

describe('补刀归属与统一时间步', () => {
  it('玩家普攻命中的最后一击计 CS，且每次死亡只结算一次', () => {
    const sim = training();
    advance(sim, 0.5);
    const enemy = sim.lane.minions.find(m => m.team === 'red')!;
    enemy.x = GAME_CONFIG.player.spawn.x + 100; enemy.y = GAME_CONFIG.player.spawn.y;
    enemy.receiveDamage(enemy.health - 30, blueSource);
    sim.motion.heading = 0;
    sim.combat.leftClick(enemy);
    advance(sim, 0.8);
    expect(enemy.alive).toBe(false);
    expect(sim.lane.stats.cs).toBe(1);
    expect(sim.lane.stats.missed).toBe(0);
    expect(enemy.receiveDamage(60, playerSource)).toBe(0);
    expect(sim.lane.stats.totalDeaths).toBe(1);
  });

  it('玩家只削血而由友军收尾计漏刀，友军死亡不计漏刀', () => {
    const sim = training();
    advance(sim, 0.5);
    const red = sim.lane.minions.find(m => m.team === 'red')!;
    const blue = sim.lane.minions.find(m => m.team === 'blue')!;
    red.receiveDamage(60, playerSource);
    red.receiveDamage(100000, blueSource);
    blue.receiveDamage(100000, redSource);
    expect(sim.lane.stats.cs).toBe(0);
    expect(sim.lane.stats.missed).toBe(1);
    expect(sim.lane.stats.totalDeaths).toBe(2);
  });

  it('重复死亡事件不会重复计数，成功率分母只含红方死亡', () => {
    const stats = new LastHitStats();
    const event = { id: 'red-1', team: 'red', kind: 'melee', source: playerSource, x: 0, y: 0 } as const;
    stats.record(event); stats.record(event);
    stats.record({ ...event, id: 'red-2', source: blueSource });
    stats.record({ ...event, id: 'blue-1', team: 'blue', source: redSource });
    expect(stats.cs).toBe(1);
    expect(stats.missed).toBe(1);
    expect(stats.totalDeaths).toBe(3);
    expect(stats.successRate).toBe(0.5);
  });

  it('蓝方小兵不可被玩家选中攻击，且小兵之间没有友方伤害', () => {
    const sim = training();
    advance(sim, 0.5);
    const blue = sim.lane.minions.find(m => m.team === 'blue')!;
    expect(sim.combat.attackTarget(blue)).toBe(false);
    expect(blue.receiveDamage(1000, blueSource)).toBe(0);
    advance(sim, 0.5);
    expect(sim.combat.shotsFired).toBe(0);
  });

  it('30/60/120/144 FPS 下波次、死亡、血量及位置一致', () => {
    const results = [30, 60, 120, 144].map(fps => {
      const sim = training();
      advance(sim, 61, fps);
      return { wave: sim.lane.wave, cs: sim.lane.stats.cs, missed: sim.lane.stats.missed, deaths: sim.lane.stats.totalDeaths,
        units: sim.lane.minions.map(m => ({ id: m.id, x: m.x, y: m.y, health: m.health })) };
    });
    expect(results[0].deaths).toBeGreaterThan(0);
    for (const result of results) expect(result).toEqual(results[0]);
  });
});
