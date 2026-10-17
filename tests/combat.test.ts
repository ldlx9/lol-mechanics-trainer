import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { BasicAttack } from '../src/combat/BasicAttack';
import { CombatController } from '../src/combat/CombatController';
import { TrainingTarget } from '../src/combat/TrainingTarget';
import { Movement } from '../src/simulation/Movement';

const timing = { attackSpeed: 1, windupRatio: 0.3, releaseFeedbackSeconds: 0.04 };
const targetRef = { id: 'red', generation: 0 };

function target(id: string, x: number, y = 393, team: 'red' | 'blue' = 'red', maxHealth = 10000) {
  return new TrainingTarget(id, id, team, { x, y }, { ...GAME_CONFIG.trainingTargets, maxHealth });
}

function trainer(targets = [target('red', 750)], overrides = {}) {
  // 固定测试场景几何，地图中心变化不应改变前摇和弹道测试的初始朝向。
  const motion = new Movement({ x: 550, y: 393 }, GAME_CONFIG.player, GAME_CONFIG.world);
  motion.heading = 0;
  const combat = new CombatController(motion, targets, { ...GAME_CONFIG.combat, ...timing, ...overrides });
  return combat;
}

describe('普通左键点选攻击', () => {
  it.each([
    ['模型', 0, 0],
    ['血条边缘', 33, -36],
    ['目标名称', 0, 49],
    ['血量文字', 0, 72],
  ] as const)('直接左键点击%s即可持续平 A，无需 A 前缀', (_part, dx, dy) => {
    const enemy = target('red', 750);
    const combat = trainer([enemy]);
    expect(combat.leftClick({ x: enemy.x + dx, y: enemy.y + dy })).toBe(true);
    expect(combat.order).toEqual({ kind: 'attack', targetId: enemy.id });
    combat.update(0.9);
    expect(combat.hitsLanded).toBe(1);
    combat.update(1.4);
    expect(combat.hitsLanded).toBeGreaterThanOrEqual(2);
  });

  it('普通左键空地不误触附近的敌人', () => {
    const combat = trainer();
    expect(combat.leftClick({ x: 1030, y: 700 })).toBe(false);
    combat.update(2);
    expect(combat.shotsFired).toBe(0);
    expect(combat.order.kind).toBe('idle');
  });

  it('左键友方血条或名字仍不能攻击友方', () => {
    const blue = target('blue', 750, 393, 'blue');
    const combat = trainer([blue]);
    combat.leftClick({ x: blue.x + 33, y: blue.y - 36 });
    combat.leftClick({ x: blue.x, y: blue.y + 50 });
    combat.update(1);
    expect(combat.shotsFired).toBe(0);
    expect(blue.health).toBe(blue.config.maxHealth);
  });

  it('身体优先于重叠的其他单位名称，避免点错目标', () => {
    const behind = target('behind', 750, 393);
    const front = target('front', 750, 445);
    const combat = trainer([behind, front]);
    combat.leftClick({ x: front.x, y: front.y });
    expect(combat.activeTarget?.id).toBe('front');
  });

  it('已死亡目标的血条和名称不可选中', () => {
    const enemy = target('red', 750);
    const combat = trainer([enemy]);
    enemy.receiveDamage(100000);
    expect(combat.leftClick({ x: enemy.x, y: enemy.y + 50 })).toBe(false);
    combat.update(1);
    expect(combat.shotsFired).toBe(0);
  });
});

describe('平 A 状态机', () => {
  it('依次经历五个状态，一次前摇恰好产生一次发射事件', () => {
    const attack = new BasicAttack(timing);
    expect(attack.state).toBe('Idle');
    expect(attack.start(targetRef)).toBe(true);
    expect(attack.state).toBe('Windup');
    expect(attack.advance(0.29)).toBeNull();
    expect(attack.advance(0.01)).toEqual(targetRef);
    expect(attack.state).toBe('AttackReleased');
    expect(attack.advance(0.05)).toBeNull();
    expect(attack.state).toBe('Recovery');
    attack.advance(0.65);
    expect(attack.state).toBe('Ready');
    expect(attack.canStart).toBe(true);
  });

  it('前摇结束之前移动，不产生发射事件', () => {
    const attack = new BasicAttack(timing);
    attack.start(targetRef);
    attack.advance(0.299);
    expect(attack.cancelForMovement()).toBe(true);
    expect(attack.advance(1)).toBeNull();
    expect(attack.state).toBe('Idle');
  });

  it('取消后摇仍须等到独立冷却结束', () => {
    const attack = new BasicAttack(timing);
    attack.start(targetRef);
    attack.advance(0.3);
    attack.cancelForMovement();
    expect(attack.recoveryCancelled).toBe(true);
    for (let i = 0; i < 69; i++) {
      expect(attack.start(targetRef)).toBe(false);
      attack.cancelForMovement();
      attack.advance(0.01);
    }
    expect(attack.cooldownRemaining).toBeCloseTo(0.01);
    expect(attack.start(targetRef)).toBe(false);
    attack.advance(0.01);
    expect(attack.start(targetRef)).toBe(true);
  });

  it('目标在前摇中失效，不会生成弹道', () => {
    const attack = new BasicAttack(timing);
    attack.start(targetRef);
    expect(attack.advance(0.5, false)).toBeNull();
    expect(attack.state).toBe('Idle');
  });
});

describe('指定目标、走 A 与攻击移动', () => {
  it('前摇取消没有弹道或伤害，角色立即开始接受移动指令', () => {
    const combat = trainer();
    const enemy = combat.targets[0] as TrainingTarget;
    combat.attackTarget(enemy);
    combat.update(0.2);
    expect(combat.attack.state).toBe('Windup');
    combat.moveTo({ x: 400, y: 393 });
    combat.update(1);
    expect(combat.shotsFired).toBe(0);
    expect(enemy.health).toBe(enemy.config.maxHealth);
    expect(combat.cancelledWindups).toBe(1);
    expect(combat.motion.x).toBeLessThan(550);
  });

  it('发射后右键移动保留弹道，命中后只结算一次伤害', () => {
    const combat = trainer([target('red', 800)], { projectileSpeed: 250 });
    const enemy = combat.targets[0] as TrainingTarget;
    combat.attackTarget(enemy);
    combat.update(0.31);
    expect(combat.shotsFired).toBe(1);
    expect(combat.projectiles).toHaveLength(1);
    combat.moveTo({ x: 400, y: 393 });
    combat.update(1.5);
    expect(combat.motion.x).toBeLessThan(550);
    expect(combat.hitsLanded).toBe(1);
    expect(enemy.health).toBe(enemy.config.maxHealth - GAME_CONFIG.combat.attackDamage);
    expect(combat.projectiles).toHaveLength(0);
  });

  it('射程外自动追击，进入有效范围停下并开火', () => {
    const enemy = target('far', 1040);
    const combat = trainer([enemy], { attackRange: 180 });
    combat.attackTarget(enemy);
    combat.update(0.2);
    expect(combat.shotsFired).toBe(0);
    expect(combat.motion.x).toBeGreaterThan(550);
    combat.update(2);
    expect(combat.shotsFired).toBeGreaterThan(0);
    expect(combat.motion.target).toBeNull();
    expect(combat.motion.x).toBeLessThan(enemy.x - enemy.collisionRadius - combat.motion.config.collisionRadius);
  });

  it('反复点击相同敌人不会重置前摇或额外发射', () => {
    const combat = trainer();
    const enemy = combat.targets[0];
    for (let i = 0; i < 48; i++) {
      combat.attackTarget(enemy);
      combat.update(1 / 120);
    }
    expect(combat.shotsFired).toBe(1);
  });

  it('友方目标不可攻击，也不能被普攻弹道误伤', () => {
    const blue = target('blue', 620, 393, 'blue');
    const red = target('red', 750);
    const combat = trainer([blue, red]);
    expect(combat.attackTarget(blue)).toBe(false);
    combat.update(1);
    expect(combat.shotsFired).toBe(0);
    combat.attackTarget(red);
    combat.update(0.8);
    expect(red.health).toBeLessThan(red.config.maxHealth);
    expect(blue.health).toBe(blue.config.maxHealth);
  });

  it('A 地面点击优先鼠标附近的敌人，允许指定远处目标', () => {
    const nearPlayer = target('near-player', 600);
    const nearCursor = target('near-cursor', 980);
    const combat = trainer([nearPlayer, nearCursor]);
    combat.attackMove({ x: 995, y: 400 });
    expect(combat.order).toEqual({ kind: 'attack', targetId: 'near-cursor' });
    combat.update(0.1);
    expect(combat.activeTarget?.id).toBe('near-cursor');
    expect(combat.shotsFired).toBe(0);
  });

  it('鼠标附近没有目标时按配置沿途寻敌；普通右键不自动攻击', () => {
    const enemy = target('red', 970, 550);
    const combat = trainer([enemy], { attackMoveAcquireRadius: 200, attackRange: 150 });
    combat.moveTo({ x: 1050, y: 700 });
    combat.update(2);
    expect(combat.shotsFired).toBe(0);
    const seeking = trainer([target('red', 970, 550)], { attackMoveAcquireRadius: 200, attackRange: 150 });
    seeking.attackMove({ x: 1050, y: 700 });
    seeking.update(0.1);
    expect(seeking.activeTarget).toBeNull();
    seeking.update(3);
    expect(seeking.shotsFired).toBeGreaterThan(0);
  });

  it('move-only 配置下，鼠标附近没有敌人就只移动，不沿途自动开火', () => {
    const combat = trainer([target('red', 700)], { attackMoveRule: 'move-only' });
    combat.attackMove({ x: 1000, y: 700 });
    combat.update(4);
    expect(combat.shotsFired).toBe(0);
    expect(Math.hypot(combat.motion.x - 1000, combat.motion.y - 700)).toBeLessThanOrEqual(0.5);
  });

  it('无敌方单位时攻击移动到目的地后停止', () => {
    const combat = trainer([]);
    combat.attackMove({ x: 800, y: 600 });
    combat.update(4);
    expect(combat.shotsFired).toBe(0);
    expect(Math.hypot(combat.motion.x - 800, combat.motion.y - 600)).toBeLessThanOrEqual(0.5);
    expect(combat.motion.velocity).toEqual({ x: 0, y: 0 });
  });

  it('目标死亡后旧弹道作废，不能伤害重生的新一代目标', () => {
    const enemy = target('red', 800);
    const combat = trainer([enemy], { projectileSpeed: 50 });
    combat.attackTarget(enemy);
    combat.update(0.31);
    expect(combat.projectiles).toHaveLength(1);
    enemy.receiveDamage(100000);
    combat.update(4);
    expect(enemy.generation).toBe(1);
    expect(enemy.health).toBe(enemy.config.maxHealth);
    expect(combat.hitsLanded).toBe(0);
    expect(combat.projectiles).toHaveLength(0);
  });

  it('高速普攻弹道不会穿过目标而漏判', () => {
    const combat = trainer([target('red', 750)], { projectileSpeed: 100000 });
    combat.attackTarget(combat.targets[0]);
    combat.update(0.31);
    expect(combat.hitsLanded).toBe(1);
    expect(combat.projectiles).toHaveLength(0);
  });

  it('30/60/120/144 FPS 下持续攻击次数和伤害相同', () => {
    const results = [30, 60, 120, 144].map(fps => {
      const combat = trainer();
      combat.attackTarget(combat.targets[0]);
      for (let i = 0; i < fps * 5; i++) combat.update(1 / fps);
      return { shots: combat.shotsFired, hits: combat.hitsLanded, health: (combat.targets[0] as TrainingTarget).health };
    });
    expect(results[0].shots).toBe(5);
    for (const result of results) expect(result).toEqual(results[0]);
  });
});
