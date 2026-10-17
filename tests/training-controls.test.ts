import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { MINION_CONFIG } from '../src/config/minions';
import { DODGE_CONFIG, VITALS_CONFIG } from '../src/config/skillshots';
import { CombatController } from '../src/combat/CombatController';
import { TrainingTarget } from '../src/combat/TrainingTarget';
import { PlayerVitals } from '../src/combat/PlayerVitals';
import { PlayerAnimation } from '../src/entities/PlayerAnimation';
import { LaneTraining } from '../src/minions/LaneTraining';
import { Movement } from '../src/simulation/Movement';
import { SkillshotSystem } from '../src/skillshots/SkillshotSystem';

function combatSetup() {
  const motion = new Movement({ x: 500, y: 500 }, GAME_CONFIG.player, GAME_CONFIG.world);
  motion.heading = 0;
  const target = new TrainingTarget('red', '红兵', 'red', { x: 800, y: 500 }, GAME_CONFIG.trainingTargets);
  return { motion, target, combat: new CombatController(motion, [target], GAME_CONFIG.combat) };
}

function training() {
  const motion = new Movement(GAME_CONFIG.player.spawn, GAME_CONFIG.player, GAME_CONFIG.world);
  const sim = new LaneTraining(motion, structuredClone(MINION_CONFIG), GAME_CONFIG.combat);
  const skills = new SkillshotSystem(motion, sim.lane.minions, new PlayerVitals(VITALS_CONFIG), structuredClone(DODGE_CONFIG), () => 0.2);
  const view = { x: 0, y: 0, ...GAME_CONFIG.world };
  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 120); i++) sim.update(1 / 120, dt => skills.step(dt, view));
  };
  return { sim, skills, advance };
}

describe('S 停止指令', () => {
  it('停止移动及攻击移动寻敌，速度立即归零并显示站姿', () => {
    const { motion, combat } = combatSetup();
    combat.moveTo({ x: 1200, y: 500 });
    combat.update(0.1);
    expect(motion.velocity.x).toBeGreaterThan(0);
    combat.stop();
    const position = { x: motion.x, y: motion.y };
    combat.update(2);
    expect(motion).toMatchObject({ ...position, target: null, velocity: { x: 0, y: 0 } });
    combat.attackMove({ x: 1200, y: 500 });
    combat.stop();
    combat.update(1);
    expect(combat.order.kind).toBe('idle');
    expect(combat.activeTarget).toBeNull();
    expect(combat.shotsFired).toBe(0);
    expect(new PlayerAnimation(GAME_CONFIG.player.moveSpeed).update(0, 0, combat.attack)).toBe('idle');
  });

  it('前摇中停止不发射、不造成伤害，也不继续自动攻击', () => {
    const { combat, target } = combatSetup();
    combat.attackTarget(target);
    combat.update(0.1);
    expect(combat.attack.state).toBe('Windup');
    combat.stop();
    combat.update(2);
    expect(combat.attack.state).toBe('Idle');
    expect(combat.cancelledWindups).toBe(1);
    expect(combat.shotsFired).toBe(0);
    expect(target.health).toBe(target.config.maxHealth);
  });

  it('发射后 S 不撤回弹道，重复停止也不能绕过冷却', () => {
    const { combat, target } = combatSetup();
    combat.attackTarget(target);
    combat.update(combat.attack.windupSeconds + 0.01);
    expect(combat.projectiles).toHaveLength(1);
    const readyAt = combat.attack.readyAt;
    combat.stop(); combat.stop();
    expect(combat.attack.state).toBe('Idle');
    expect(combat.attack.readyAt).toBe(readyAt);
    expect(combat.attack.canStart).toBe(false);
    combat.update(0.4);
    expect(combat.shotsFired).toBe(1);
    expect(combat.hitsLanded).toBe(1);
    expect(target.health).toBe(target.config.maxHealth - GAME_CONFIG.combat.attackDamage);
    expect(combat.attack.start({ id: target.id, generation: target.generation })).toBe(false);
  });
});

describe('独立训练生成开关', () => {
  it.each([[true, true], [true, false], [false, true], [false, false]])('兵线=%s、技能=%s 独立生成', (minions, skillshots) => {
    const { sim, skills, advance } = training();
    sim.setMinionsEnabled(minions);
    skills.setEnabled(skillshots);
    advance(3);
    expect(sim.lane.minions.length > 0).toBe(minions);
    expect(skills.stats.fired > 0).toBe(skillshots);
    expect(sim.lane.enabled).toBe(minions);
    expect(skills.enabled).toBe(skillshots);
  });

  it('关闭兵线使已有对象立即死亡失活，清理弹道，不污染成绩或技能', () => {
    const { sim, skills, advance } = training();
    advance(1);
    const minions = [...sim.lane.minions];
    const array = sim.lane.minions;
    const enemy = minions.find(m => m.team === 'red')!;
    sim.combat.attackTarget(enemy);
    sim.combat.attack.start({ id: enemy.id, generation: 0 });
    skills.fire({ x: 0, y: 0, ...GAME_CONFIG.world });
    const skillIds = skills.projectiles.map(p => p.id);
    sim.lane.meleeEffects.push({ x: 0, y: 0, toX: 1, toY: 1, team: 'blue', age: 0 });
    sim.setMinionsEnabled(false);
    expect(minions.every(m => !m.alive && m.health === 0 && m.motion.target === null)).toBe(true);
    expect(sim.lane.minions).toBe(array);
    expect(sim.lane.minions).toHaveLength(0);
    expect(sim.lane.meleeEffects).toHaveLength(0);
    expect(sim.lane.projectiles).toHaveLength(0);
    expect(sim.combat.attack.state).toBe('Idle');
    expect(sim.combat.activeTarget).toBeNull();
    expect(sim.lane.stats).toMatchObject({ cs: 0, missed: 0, totalDeaths: 0 });
    expect(skills.projectiles.map(p => p.id)).toEqual(skillIds);
    expect(skills.enabled).toBe(true);
  });

  it('关闭期间不累积波次，重新开启按短延迟恢复，不补发旧波', () => {
    const { sim, advance } = training();
    advance(1);
    const wave = sim.lane.wave;
    sim.setMinionsEnabled(false);
    advance(91);
    expect(sim.lane.wave).toBe(wave);
    expect(sim.lane.minions).toHaveLength(0);
    sim.setMinionsEnabled(true);
    advance(0.25);
    sim.setMinionsEnabled(true); // 重复开启不重置等待时间。
    advance(0.25);
    expect(sim.lane.wave).toBe(wave + 1);
    expect(sim.lane.minions).toHaveLength(12);
  });

  it('关闭兵线不打断独立地面移动，关闭技能不清除小兵、不增加躲避', () => {
    const { sim, skills, advance } = training();
    advance(1);
    skills.fire({ x: 0, y: 0, ...GAME_CONFIG.world });
    const minions = [...sim.lane.minions];
    skills.setEnabled(false);
    expect(skills.projectiles).toHaveLength(0);
    expect(skills.stats.dodges).toBe(0);
    expect(sim.lane.minions).toEqual(minions);
    sim.combat.moveTo({ x: 1400, y: 1000 });
    const destination = { ...sim.motion.target! };
    sim.setMinionsEnabled(false);
    expect(sim.motion.target).toEqual(destination);
    expect(sim.combat.order.kind).toBe('move');
  });
});
