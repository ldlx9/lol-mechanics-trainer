import { afterEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { PlayerInput } from '../src/input/PlayerInput';
import { CombatController } from '../src/combat/CombatController';
import { TrainingTarget } from '../src/combat/TrainingTarget';
import { Movement } from '../src/simulation/Movement';
import { GAME_CONFIG } from '../src/config/game';

vi.mock('phaser', () => ({ default: { Math: { Vector2: class { x = 0; y = 0; } } } }));
afterEach(() => vi.unstubAllGlobals());

it('S 取消 A 待命与右键持续移动；保持按住右键不会重新下达旧移动', () => {
  const events = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('window', events());
  vi.stubGlobal('document', events());
  const keys = new Map<string, (event: KeyboardEvent) => void>();
  let pointerDown: (pointer: Phaser.Input.Pointer) => void = vi.fn();
  const move = vi.fn(); const stop = vi.fn();
  const scene = {
    game: { canvas: { ...events(), classList: { toggle: vi.fn() } } },
    input: {
      mouse: { disableContextMenu: vi.fn() }, activePointer: { x: 900, y: 500 },
      keyboard: { on: (name: string, handler: (event: KeyboardEvent) => void) => keys.set(name, handler), off: vi.fn() },
      on: (_name: string, handler: typeof pointerDown, context: unknown) => { pointerDown = handler.bind(context); }, off: vi.fn(),
    },
    cameras: { main: { getWorldPoint: (x: number, y: number, out: { x: number; y: number }) => { out.x = x; out.y = y; } } },
  } as unknown as Phaser.Scene;
  const input = new PlayerInput(scene, { move, stop, leftClick: vi.fn() });
  pointerDown({ button: 2, x: 900, y: 500 } as Phaser.Input.Pointer);
  keys.get('keydown-S')!({ ctrlKey: true } as KeyboardEvent);
  expect(stop).not.toHaveBeenCalled();
  keys.get('keydown-S')!({} as KeyboardEvent);
  input.update();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(move).toHaveBeenCalledTimes(1);
  keys.get('keydown-A')!({} as KeyboardEvent);
  expect(input.attackMoveArmed).toBe(true);
  keys.get('keydown-S')!({} as KeyboardEvent);
  expect(input.attackMoveArmed).toBe(false);
  input.destroy();
  expect(scene.input.keyboard!.off).toHaveBeenCalledWith('keydown-S', expect.any(Function));
});

it('A 悬停活敌方才显示准星，离开、取消及确认指令即时恢复指针', () => {
  const eventTarget = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('window', eventTarget());
  vi.stubGlobal('document', { ...eventTarget(), hidden: false });
  const classes = new Set<string>();
  const keys = new Map<string, (event: KeyboardEvent) => void>();
  const events = new Map<string, (event?: PointerEvent) => void>();
  let pointerDown: (pointer: Phaser.Input.Pointer) => void = vi.fn();
  const canvas = {
    classList: { toggle: (name: string, force: boolean) => { if (force) classes.add(name); else classes.delete(name); } },
    addEventListener: (name: string, handler: (event?: PointerEvent) => void) => events.set(name, handler),
    removeEventListener: vi.fn(),
  };
  const scene = {
    game: { canvas },
    input: {
      mouse: { disableContextMenu: vi.fn() },
      keyboard: { on: (name: string, handler: (event: KeyboardEvent) => void) => keys.set(name, handler), off: vi.fn() },
      on: (_name: string, handler: typeof pointerDown, context: unknown) => { pointerDown = handler.bind(context); }, off: vi.fn(),
    },
    cameras: { main: { getWorldPoint: (x: number, y: number, out: { x: number; y: number }) => { out.x = x; out.y = y; } } },
  } as unknown as Phaser.Scene;
  const input = new PlayerInput(scene, { move: vi.fn(), leftClick: vi.fn(), stop: vi.fn() });
  const enemy = new TrainingTarget('red', '红兵', 'red', { x: 750, y: 393 }, GAME_CONFIG.trainingTargets);
  const friend = new TrainingTarget('blue', '蓝兵', 'blue', { x: 700, y: 393 }, GAME_CONFIG.trainingTargets);
  const armed = () => keys.get('keydown-A')!({ repeat: false } as KeyboardEvent);
  const shown = () => classes.has('attack-target-cursor');
  input.updateAttackCursor(enemy);
  expect(shown()).toBe(false);
  armed();
  input.updateAttackCursor(friend);
  expect(shown()).toBe(false);
  input.updateAttackCursor(enemy);
  expect(shown()).toBe(true);
  input.updateAttackCursor(null);
  expect(shown()).toBe(false);
  input.updateAttackCursor(enemy);
  events.get('pointerleave')!();
  expect(shown()).toBe(false);
  events.get('pointerenter')!({ buttons: 0 } as PointerEvent);
  input.updateAttackCursor(enemy);
  expect(shown()).toBe(true);
  keys.get('keydown-ESC')!({} as KeyboardEvent);
  expect(shown()).toBe(false);
  for (const button of [0, 2]) {
    armed(); input.updateAttackCursor(enemy);
    expect(shown()).toBe(true);
    pointerDown({ button, x: 750, y: 393 } as Phaser.Input.Pointer);
    expect(shown()).toBe(false);
    expect(input.attackMoveArmed).toBe(false);
  }
  armed(); input.updateAttackCursor(enemy);
  enemy.receiveDamage(100000);
  input.updateAttackCursor(enemy);
  expect(shown()).toBe(false);
  input.updateAttackCursor(new TrainingTarget('other-red', '红兵', 'red', enemy, GAME_CONFIG.trainingTargets));
  expect(shown()).toBe(true);
  input.destroy();
  expect(shown()).toBe(false);
});

it('按住右键后再左键敌人，也能切换为持续普攻，右键持续更新不会覆盖该指令', () => {
  const eventTarget = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('window', eventTarget());
  vi.stubGlobal('document', eventTarget());
  let onPointerDown: (pointer: Phaser.Input.Pointer) => void = () => { throw new Error('未绑定鼠标事件'); };
  const scene = {
    game: { canvas: eventTarget() },
    input: {
      mouse: { disableContextMenu: vi.fn() },
      keyboard: { on: vi.fn(), off: vi.fn() },
      activePointer: { x: 100, y: 100 },
      on: (event: string, handler: typeof onPointerDown, context: unknown) => {
        if (event === 'pointerdown') onPointerDown = handler.bind(context);
      },
      off: vi.fn(),
    },
    cameras: { main: { getWorldPoint: (x: number, y: number, output: { x: number; y: number }) => {
      output.x = x; output.y = y; return output;
    } } },
  } as unknown as Phaser.Scene;
  const motion = new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world);
  motion.heading = 0;
  const enemy = new TrainingTarget('red', '红靶', 'red', { x: 750, y: 393 }, GAME_CONFIG.trainingTargets);
  const combat = new CombatController(motion, [enemy], GAME_CONFIG.combat);
  const input = new PlayerInput(scene, {
    stop: () => combat.stop(),
    move: point => combat.moveTo(point),
    leftClick: (point, armed) => combat.leftClick(point, armed),
  });
  const pointer = (button: number, x: number, y: number) => ({
    button, x, y,
    rightButtonDown: () => true,
    leftButtonDown: () => button === 0,
  } as unknown as Phaser.Input.Pointer);
  onPointerDown(pointer(2, 100, 100));
  expect(combat.order.kind).toBe('move');
  onPointerDown(pointer(0, enemy.x, enemy.y));
  input.update();
  expect(input.attackMoveArmed).toBe(false);
  expect(combat.order).toEqual({ kind: 'attack', targetId: enemy.id });
  combat.update(0.9);
  expect(combat.hitsLanded).toBe(1);
  expect(enemy.health).toBe(180);
  input.destroy();
});
