import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { MINION_CONFIG } from '../src/config/minions';
import { ROAD_CONFIG } from '../src/config/road';
import type { MinionKind } from '../src/config/minions';
import { Movement } from '../src/simulation/Movement';
import type { Point } from '../src/simulation/Movement';
import { RoadCorridor } from '../src/simulation/RoadCorridor';
import { LaneTraining } from '../src/minions/LaneTraining';

const road = new RoadCorridor(ROAD_CONFIG, GAME_CONFIG.world);
function roadPoint(along: number, sideways: number): Point {
  return { x: ROAD_CONFIG.center.x + road.forward.x * along + road.normal.x * sideways,
    y: ROAD_CONFIG.center.y + road.forward.y * along + road.normal.y * sideways };
}
function training(stationary = false) {
  const config = structuredClone(MINION_CONFIG);
  config.waveInterval = 999;
  config.acquireRange = 0;
  if (stationary) for (const spec of Object.values(config.stats)) spec.moveSpeed = 0;
  const sim = new LaneTraining(new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world), config, GAME_CONFIG.combat);
  for (let i = 0; i < 60; i++) sim.update(1 / 120);
  return sim;
}

describe('道路与移动共用的几何边界', () => {
  it('出生点、出口和移动目标都同时满足道路宽度与世界边界', () => {
    const sim = training();
    for (const minion of sim.lane.minions) {
      expect(sim.lane.road.contains(minion, minion.collisionRadius)).toBe(true);
      expect(sim.lane.road.contains(minion.destination, minion.collisionRadius)).toBe(true);
      minion.motion.moveTo({ x: 0, y: 0 });
      expect(sim.lane.road.contains(minion.motion.target!, minion.collisionRadius)).toBe(true);
    }
  });

  it('道路投影在四个世界角落保持合法且幂等', () => {
    for (const radius of [14, 16, 21]) {
      for (const point of [{ x: 0, y: 0 }, { x: 1540, y: 0 }, { x: 0, y: 1100 }, { x: 1540, y: 1100 }]) {
        const projected = road.project(point, radius);
        expect(road.contains(projected, radius)).toBe(true);
        expect(road.project(projected, radius)).toEqual(projected);
        expect(projected.x).toBeGreaterThanOrEqual(radius - 1e-7);
        expect(projected.y).toBeLessThanOrEqual(GAME_CONFIG.world.height - radius + 1e-7);
      }
    }
  });

  it('朝外的转向弧线也不能离开道路，投影不突破移速', () => {
    const radius = GAME_CONFIG.player.collisionRadius;
    const edge = ROAD_CONFIG.halfWidth - ROAD_CONFIG.edgeInset - radius;
    const motion = new Movement(roadPoint(-100, edge), GAME_CONFIG.player, GAME_CONFIG.world, road);
    motion.heading = Math.atan2(road.normal.y, road.normal.x);
    motion.moveTo(roadPoint(300, edge));
    for (let i = 0; i < 360; i++) {
      const before = { x: motion.x, y: motion.y };
      motion.step(1 / 120);
      expect(road.contains(motion, radius)).toBe(true);
      expect(Math.hypot(motion.x - before.x, motion.y - before.y)).toBeLessThanOrEqual(GAME_CONFIG.player.moveSpeed / 120 + 1e-7);
    }
  });

  it('路边密集单位互相让位时仍保持整个身体在道路内', () => {
    const sim = training(true);
    const side = ROAD_CONFIG.halfWidth - ROAD_CONFIG.edgeInset - MINION_CONFIG.stats.melee.collisionRadius;
    const edge = roadPoint(0, side);
    for (const minion of sim.lane.minions) {
      const position = road.project(edge, minion.collisionRadius);
      minion.x = position.x; minion.y = position.y;
    }
    for (let i = 0; i < 240; i++) {
      sim.update(1 / 120);
      for (const minion of sim.lane.minions) expect(road.contains(minion, minion.collisionRadius)).toBe(true);
    }
    expect(new Set(sim.lane.minions.map(m => `${m.x},${m.y}`)).size).toBeGreaterThan(1);
  });
});

describe('路外脱战与自动回路', () => {
  it.each(['melee', 'ranged', 'cannon'] as MinionKind[])('%s 被带到路外后按自身移速走回，再恢复推进', kind => {
    const config = structuredClone(MINION_CONFIG);
    config.waveInterval = 999; config.acquireRange = 0; config.firstCannonWave = 1;
    const sim = new LaneTraining(new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world), config, GAME_CONFIG.combat);
    for (let i = 0; i < 60; i++) sim.update(1 / 120);
    const minion = sim.lane.minions.find(m => m.kind === kind && m.team === 'blue')!;
    const displaced = roadPoint(0, 330);
    minion.x = displaced.x; minion.y = displaced.y;
    minion.targetId = 'stale-target';
    minion.attack.start({ id: 'stale-target', generation: 0 });
    sim.update(1 / 120);
    expect(minion.returningToRoad).toBe(true);
    expect(minion.targetId).toBeNull();
    expect(minion.attack.state).toBe('Idle');
    expect(road.contains(minion, minion.collisionRadius)).toBe(false);
    expect(Math.hypot(minion.x - displaced.x, minion.y - displaced.y)).toBeLessThanOrEqual(minion.stats.moveSpeed / 120 + 1e-7);
    let returned = false;
    for (let i = 0; i < 1200; i++) {
      const before = { x: minion.x, y: minion.y };
      const recovering = minion.returningToRoad;
      sim.update(1 / 120);
      if (recovering && minion.returningToRoad) expect(Math.hypot(minion.x - before.x, minion.y - before.y)).toBeLessThanOrEqual(minion.stats.moveSpeed / 120 + 1e-7);
      if (!minion.returningToRoad) {
        returned = true;
        expect(road.contains(minion, minion.collisionRadius)).toBe(true);
        expect(minion.motion.target).not.toBeNull();
        break;
      }
    }
    expect(returned).toBe(true);
    expect(sim.lane.stats.totalDeaths).toBe(0);
  });

  it('不追击路外敌人，也不站在路外继续攻击', () => {
    const sim = training();
    sim.lane.config.acquireRange = 360;
    const blue = sim.lane.minions.find(m => m.team === 'blue')!;
    const red = sim.lane.minions.find(m => m.team === 'red')!;
    const bluePoint = roadPoint(0, 160); const redPoint = roadPoint(0, 210);
    blue.x = bluePoint.x; blue.y = bluePoint.y;
    red.x = redPoint.x; red.y = redPoint.y;
    blue.targetId = red.id; red.targetId = blue.id;
    blue.attack.start({ id: red.id, generation: 0 });
    red.attack.start({ id: blue.id, generation: 0 });
    const health = [blue.health, red.health];
    for (let i = 0; i < 30; i++) sim.update(1 / 120);
    expect(blue.targetId).not.toBe(red.id);
    expect(red.targetId).toBeNull();
    expect(red.returningToRoad).toBe(true);
    expect([blue.health, red.health]).toEqual(health);
    expect(red.attack.state).toBe('Idle');
  });

  it('长时间行军、近战展开和远程追击都不会把兵线带出道路', () => {
    const sim = new LaneTraining(new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world), MINION_CONFIG, GAME_CONFIG.combat);
    for (let i = 0; i < 180 * 120; i++) {
      sim.update(1 / 120);
      if (i % 30 === 0) for (const minion of sim.lane.minions) {
        expect(road.contains(minion, minion.collisionRadius)).toBe(true);
        expect(Math.abs(road.signedDistance(minion)) + minion.collisionRadius).toBeLessThanOrEqual(ROAD_CONFIG.halfWidth - ROAD_CONFIG.edgeInset + 1e-6);
      }
    }
    expect(sim.lane.stats.totalDeaths).toBeGreaterThan(20);
  });

  it('强制偏离后的回路与后续交战在不同帧率下相同', () => {
    const results = [30, 60, 120, 144].map(fps => {
      const sim = training();
      const minion = sim.lane.minions[0];
      const displaced = roadPoint(0, -300);
      minion.x = displaced.x; minion.y = displaced.y;
      for (let i = 0; i < 12 * fps; i++) sim.update(1 / fps);
      expect(minion.returningToRoad).toBe(false);
      return sim.lane.minions.map(m => ({ id: m.id, x: m.x, y: m.y, returning: m.returningToRoad }));
    });
    for (const result of results) expect(result).toEqual(results[0]);
  });
});
