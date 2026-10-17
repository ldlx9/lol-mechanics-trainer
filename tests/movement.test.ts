import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { Movement, advanceMovement, wrapAngle } from '../src/simulation/Movement';

const spawn = GAME_CONFIG.player.spawn;
const world = GAME_CONFIG.world;

function create() {
  return new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world);
}

function simulate(fps: number, seconds: number): Movement {
  const model = create();
  model.moveTo({ x: world.width - 100, y: spawn.y });
  for (let i = 0; i < fps * seconds; i++) advanceMovement(model, 1 / fps);
  return model;
}

describe('delta-time 移动', () => {
  it('30 / 60 / 120 / 144 FPS 两秒移动偏差小于 1 单位', () => {
    const reference = simulate(120, 2);
    for (const fps of [30, 60, 144]) {
      const model = simulate(fps, 2);
      expect(Math.hypot(model.x - reference.x, model.y - reference.y)).toBeLessThan(1);
    }
  });

  it('反向指令不会瞬间反转或突破移动速度', () => {
    const model = create();
    model.heading = 0;
    model.moveTo({ x: 100, y: spawn.y });
    model.step(1 / 120);
    expect(Math.abs(wrapAngle(model.heading))).toBeCloseTo(GAME_CONFIG.player.turnSpeed / 120);
    expect(model.x).toBe(spawn.x);
    advanceMovement(model, 1);
    expect(model.x).toBeLessThan(spawn.x);
    expect(Math.hypot(model.velocity.x, model.velocity.y)).toBeLessThanOrEqual(GAME_CONFIG.player.moveSpeed + 0.00001);
  });

  it('到达目标后停下，持续更新不引发振荡', () => {
    const model = create();
    const target = { x: spawn.x + 100, y: spawn.y + 100 };
    model.moveTo(target);
    advanceMovement(model, 5);
    expect(model.target).toBeNull();
    expect(Math.hypot(model.x - target.x, model.y - target.y)).toBeLessThanOrEqual(0.5);
    const before = { x: model.x, y: model.y };
    advanceMovement(model, 2);
    expect(model.x).toBe(before.x);
    expect(model.y).toBe(before.y);
    expect(model.velocity).toEqual({ x: 0, y: 0 });
  });

  it('目标和角色始终留在碰撞半径允许的世界边界内', () => {
    const model = create();
    model.moveTo({ x: -1000, y: 8000 });
    expect(model.target).toEqual({ x: 20, y: world.height - 20 });
    advanceMovement(model, 20);
    expect(model.x).toBeGreaterThanOrEqual(20);
    expect(model.y).toBeLessThanOrEqual(world.height - 20);
    expect(model.target).toBeNull();
  });

  it('连续覆盖目标遵循最后一次指令，零 delta 不移动', () => {
    const model = create();
    model.moveTo({ x: spawn.x + 200, y: spawn.y + 200 });
    const target = { x: spawn.x - 200, y: spawn.y - 100 };
    model.moveTo(target);
    advanceMovement(model, 0);
    expect(model.x).toBe(spawn.x);
    advanceMovement(model, 5);
    expect(Math.hypot(model.x - target.x, model.y - target.y)).toBeLessThanOrEqual(0.5);
  });
});
