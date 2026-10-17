import type { Movement } from '../simulation/Movement';
import type { CombatController } from '../combat/CombatController';
import type { LaneSystem } from '../minions/LaneSystem';
import type { SkillshotSystem } from '../skillshots/SkillshotSystem';
import type { DodgeDifficulty } from '../config/skillshots';

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少界面元素：${id}`);
  return node as T;
}

export class TrainingHud {
  private readonly speed = element('speed');
  private readonly fps = element('fps');
  private readonly attackState = element('attack-state');
  private readonly attackDescription = element('attack-description');
  private readonly attackProgress = element('attack-progress');
  private readonly attackReadout = element('combat-readout');
  private readonly attackAim = element('attack-aim');
  private readonly attackTarget = element('attack-target');
  private readonly attackCooldown = element('attack-cooldown');
  private readonly shotsFired = element('shots-fired');
  private readonly hitsLanded = element('hits-landed');
  private readonly cancelledWindups = element('cancelled-windups');
  private readonly cs = element('cs');
  private readonly missed = element('missed');
  private readonly csRate = element('cs-rate');
  private readonly deaths = element('minion-deaths');
  private readonly wave = element('wave-number');
  private readonly nextWave = element('next-wave');
  private readonly laneTime = element('lane-time');
  private readonly blueCount = element('blue-count');
  private readonly redCount = element('red-count');
  private readonly laneStatus = element('lane-status');
  private readonly skillHits = element('skill-hits');
  private readonly skillDodges = element('skill-dodges');
  private readonly skillBlocked = element('skill-blocked');
  private readonly skillProtected = element('skill-protected');
  private readonly skillNext = element('skill-next');
  private readonly skillActive = element('skill-active');
  private readonly skillLast = element('skill-last');
  private readonly playerHealth = element('player-health');
  private readonly healthFill = element('health-fill');
  private readonly healthStatus = element('health-status');
  private readonly gamePanel = element('game');
  private readonly easyButton = element<HTMLButtonElement>('difficulty-easy');
  private readonly advancedButton = element<HTMLButtonElement>('difficulty-advanced');
  private readonly difficultyRate = element('difficulty-rate');
  private readonly minionsToggle = element<HTMLButtonElement>('minions-toggle');
  private readonly skillshotsToggle = element<HTMLButtonElement>('skillshots-toggle');
  private displayedDifficulty: DodgeDifficulty | null = null;
  private refreshRemaining = 0;
  private frameSeconds = 0;
  private frames = 0;

  constructor(private readonly changeDifficulty: (difficulty: DodgeDifficulty) => number,
    private readonly changeGenerator: (kind: 'minions' | 'skillshots', enabled: boolean) => void) {
    this.easyButton.addEventListener('click', this.onEasyDifficulty);
    this.advancedButton.addEventListener('click', this.onAdvancedDifficulty);
    this.minionsToggle.addEventListener('click', this.onMinionsToggle);
    this.skillshotsToggle.addEventListener('click', this.onSkillshotsToggle);
  }

  private onMinionsToggle = (): void => this.toggleGenerator('minions', this.minionsToggle);
  private onSkillshotsToggle = (): void => this.toggleGenerator('skillshots', this.skillshotsToggle);

  private toggleGenerator(kind: 'minions' | 'skillshots', button: HTMLButtonElement): void {
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    this.changeGenerator(kind, enabled);
    this.drawGenerator(button, enabled);
    this.refreshRemaining = 0;
  }

  private drawGenerator(button: HTMLButtonElement, enabled: boolean): void {
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('b')!.textContent = enabled ? '开' : '关';
  }

  private onEasyDifficulty = (): void => this.selectDifficulty('easy');
  private onAdvancedDifficulty = (): void => this.selectDifficulty('advanced');

  private selectDifficulty(difficulty: DodgeDifficulty): void {
    this.drawDifficulty(difficulty, this.changeDifficulty(difficulty));
  }

  private drawDifficulty(difficulty: DodgeDifficulty, interval: number): void {
    if (this.displayedDifficulty === difficulty) return;
    this.displayedDifficulty = difficulty;
    this.easyButton.setAttribute('aria-pressed', String(difficulty === 'easy'));
    this.advancedButton.setAttribute('aria-pressed', String(difficulty === 'advanced'));
    this.difficultyRate.textContent = `约 ${interval.toFixed(1)} 秒 / 发`;
  }

  update(dt: number, model: Movement, combat: CombatController, aiming: boolean, lane: LaneSystem, skills: SkillshotSystem): void {
    this.frameSeconds += dt;
    this.frames++;
    this.refreshRemaining -= dt;
    if (this.refreshRemaining > 0) return;
    this.refreshRemaining = 0.08;
    this.speed.textContent = String(Math.round(Math.hypot(model.velocity.x, model.velocity.y)));
    if (this.frameSeconds >= 0.5) {
      this.fps.textContent = `${Math.round(this.frames / this.frameSeconds)} FPS`;
      this.frames = 0;
      this.frameSeconds = 0;
    }
    this.drawCombat(combat, aiming);
    this.drawLane(lane);
    this.drawSkills(skills);
  }

  private drawSkills(skills: SkillshotSystem): void {
    this.drawGenerator(this.skillshotsToggle, skills.enabled);
    this.drawDifficulty(skills.difficulty, skills.shotInterval);
    this.skillHits.textContent = String(skills.stats.hits);
    this.skillDodges.textContent = String(skills.stats.dodges);
    this.skillBlocked.textContent = String(skills.stats.blocked);
    this.skillProtected.textContent = String(skills.stats.protectedContacts);
    this.skillNext.textContent = skills.enabled ? `${skills.untilNextShot.toFixed(1)}s` : '已关闭';
    this.skillActive.textContent = String(skills.projectiles.length);
    this.skillLast.textContent = skills.enabled ? skills.lastShot : '场外技能已关闭';
    const vitals = skills.vitals;
    this.playerHealth.textContent = `${Math.ceil(vitals.health)} / ${vitals.config.maxHealth}`;
    this.healthFill.style.width = `${100 * vitals.health / vitals.config.maxHealth}%`;
    this.healthFill.classList.toggle('low', vitals.health <= vitals.config.maxHealth * 0.3);
    this.healthStatus.textContent = vitals.recoverAt !== null ? '恢复中' : vitals.invulnerable ? '免伤保护' : '训练中';
    this.gamePanel.classList.toggle('is-hit', vitals.hitFlash > 0);
  }

  private drawLane(lane: LaneSystem): void {
    this.drawGenerator(this.minionsToggle, lane.enabled);
    this.cs.textContent = String(lane.stats.cs);
    this.missed.textContent = String(lane.stats.missed);
    this.csRate.textContent = lane.stats.cs + lane.stats.missed > 0 ? `${(lane.stats.successRate * 100).toFixed(1)}%` : '—';
    this.deaths.textContent = String(lane.stats.totalDeaths);
    this.wave.textContent = String(lane.wave);
    this.nextWave.textContent = lane.enabled ? `${lane.untilNextWave.toFixed(1)}s` : '已关闭';
    const seconds = Math.floor(lane.time);
    this.laneTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.blueCount.textContent = String(lane.blueCount);
    this.redCount.textContent = String(lane.redCount);
    this.laneStatus.textContent = !lane.enabled ? '兵线生成已关闭 · 场上小兵已清除'
      : lane.waveSuppressed ? '达到单位上限，等待兵线消化' : '炮车每 3 波 · 黄血条可一击补刀';
  }

  private drawCombat(combat: CombatController, aiming: boolean): void {
    const attack = combat.attack;
    const labels = { Idle: '待命', Windup: '前摇', AttackReleased: '已发射', Recovery: '后摇', Ready: '就绪' };
    this.attackState.textContent = labels[attack.state];
    this.attackReadout.dataset.state = attack.state;
    const descriptions = {
      Idle: '左键点击红方小兵，开始普通攻击',
      Windup: '正在举炮 · 移动或 S 会取消本次攻击',
      AttackReleased: '弹道已发射 · 现在可以移动',
      Recovery: attack.recoveryCancelled ? '后摇已取消 · 冷却仍在计时' : '后摇阶段 · 可右键移动，不能跳过冷却',
      Ready: '攻击已就绪 · 可以再次攻击',
    };
    this.attackDescription.textContent = attack.state === 'Idle' && attack.now < combat.feedbackUntil ? combat.feedback : descriptions[attack.state];
    const progress = attack.state === 'Windup' ? attack.windupProgress
      : attack.state === 'Recovery' ? 1 - attack.cooldownRemaining / (attack.period - attack.windupSeconds)
      : attack.state === 'Idle' ? 0 : 1;
    this.attackProgress.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    this.attackAim.textContent = aiming ? 'A 指令待命 · 左键确认 / ESC 取消' : '按 A 显示射程并进入攻击移动';
    this.attackAim.classList.toggle('armed', aiming);
    this.attackCooldown.textContent = `${attack.cooldownRemaining.toFixed(2)}s`;
    this.attackTarget.textContent = combat.activeTarget
      ? `${combat.activeTarget.name} · ${combat.inAttackRange ? '射程内' : '追击中'}`
      : combat.order.kind === 'attackMove' ? '攻击移动 · 沿途寻敌' : '未选择目标';
    this.shotsFired.textContent = String(combat.shotsFired);
    this.hitsLanded.textContent = String(combat.hitsLanded);
    this.cancelledWindups.textContent = String(combat.cancelledWindups);
  }

  destroy(): void {
    this.minionsToggle.removeEventListener('click', this.onMinionsToggle);
    this.skillshotsToggle.removeEventListener('click', this.onSkillshotsToggle);
    this.easyButton.removeEventListener('click', this.onEasyDifficulty);
    this.advancedButton.removeEventListener('click', this.onAdvancedDifficulty);
  }
}
