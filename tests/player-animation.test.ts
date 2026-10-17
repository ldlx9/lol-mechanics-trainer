import { describe, expect, it } from 'vitest';
import { BasicAttack } from '../src/combat/BasicAttack';
import { GAME_CONFIG } from '../src/config/game';
import { PlayerAnimation } from '../src/entities/PlayerAnimation';

const speed = GAME_CONFIG.player.moveSpeed;

describe('角色素材与模拟状态衔接', () => {
  it('停下立即回站姿，再次移动从起步姿势播放', () => {
    const animation = new PlayerAnimation(speed);
    const attack = new BasicAttack(GAME_CONFIG.combat);
    animation.update(0.22, speed, attack);
    expect(animation.update(0, 0, attack)).toBe('idle');
    expect(animation.update(0, speed, attack)).toBe('run1');
  });

  it('前摇显示举炮，被移动取消后立刻恢复跑步，不发射攻击', () => {
    const animation = new PlayerAnimation(speed);
    const attack = new BasicAttack(GAME_CONFIG.combat);
    attack.start({ id: 'red-minion', generation: 0 });
    expect(animation.update(0.1, 0, attack)).toBe('windup');
    attack.cancelForMovement();
    expect(animation.update(0, speed, attack)).toBe('run1');
    expect(attack.advance(0.5)).toBeNull();
  });

  it('发射后取消后摇可播放跑步，攻击冷却依然生效', () => {
    const animation = new PlayerAnimation(speed);
    const attack = new BasicAttack(GAME_CONFIG.combat);
    attack.start({ id: 'red-minion', generation: 0 });
    expect(attack.advance(attack.windupSeconds)).not.toBeNull();
    expect(animation.update(0, 0, attack)).toBe('windup');
    attack.cancelForMovement();
    expect(animation.update(0, speed, attack)).toBe('run1');
    expect(attack.canStart).toBe(false);
    expect(attack.cooldownRemaining).toBeGreaterThan(0);
  });

  it('30 / 60 / 120 / 144 FPS 的相同移动时间播放到同一姿势', () => {
    for (const fps of [30, 60, 120, 144]) {
      const animation = new PlayerAnimation(speed);
      const attack = new BasicAttack(GAME_CONFIG.combat);
      for (let frame = 0; frame < fps; frame++) animation.update(1 / fps, speed, attack);
      expect(animation.update(0, speed, attack)).toBe('run2');
    }
  });

  it('同样的移动距离在不同速度下保持相同迈步进度', () => {
    const normal = new PlayerAnimation(speed);
    const slow = new PlayerAnimation(speed);
    const attack = new BasicAttack(GAME_CONFIG.combat);
    expect(slow.update(0.6, speed / 2, attack)).toBe(normal.update(0.3, speed, attack));
  });
});
