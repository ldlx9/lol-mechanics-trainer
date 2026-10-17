import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { MINION_CONFIG } from '../config/minions';
import { Player } from '../entities/Player';
import { PlayerInput } from '../input/PlayerInput';
import type { CombatController } from '../combat/CombatController';
import { LaneTraining } from '../minions/LaneTraining';
import { MinionView } from '../minions/MinionView';
import { LaneEffects } from '../minions/LaneEffects';
import { CombatEffects } from '../combat/CombatEffects';
import { TrainingHud } from '../ui/TrainingHud';
import { TrainingMap } from '../world/TrainingMap';
import { DODGE_CONFIG, VITALS_CONFIG } from '../config/skillshots';
import { PlayerVitals } from '../combat/PlayerVitals';
import { SkillshotSystem } from '../skillshots/SkillshotSystem';
import { SkillshotEffects } from '../skillshots/SkillshotEffects';
import { SKILLSHOT_VISUALS } from '../config/skillshotVisuals';
import { PLAYER_FRAMES } from '../config/playerVisuals';
import { MINION_VISUAL_LIST } from '../config/minionVisuals';

export class TrainingScene extends Phaser.Scene {
  private player!: Player;
  private map!: TrainingMap;
  private playerInput!: PlayerInput;
  private combat!: CombatController;
  private training!: LaneTraining;
  private vitals!: PlayerVitals;
  private skills!: SkillshotSystem;
  private skillEffects!: SkillshotEffects;
  private readonly minionViews = new Map<string, MinionView>();
  private laneEffects!: LaneEffects;
  private combatEffects!: CombatEffects;
  private hud!: TrainingHud;
  private marker!: Phaser.GameObjects.Graphics;
  private markerAge = 1;
  private markerX = 0;
  private markerY = 0;
  private path!: Phaser.GameObjects.Graphics;
  private gridVisible = true;

  constructor() { super('Training'); }

  preload(): void {
    for (const visual of Object.values(SKILLSHOT_VISUALS)) this.load.image(visual.key, visual.url);
    for (const frame of Object.values(PLAYER_FRAMES)) this.load.image(frame.key, frame.url);
    for (const visual of MINION_VISUAL_LIST) this.load.image(visual.key, visual.url);
  }

  create(): void {
    this.map = new TrainingMap(this);
    this.player = new Player(this);
    this.marker = this.add.graphics().setDepth(5);
    this.path = this.add.graphics().setDepth(4);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, GAME_CONFIG.world.width, GAME_CONFIG.world.height);
    this.resize();
    this.training = new LaneTraining(this.player.motion, MINION_CONFIG, GAME_CONFIG.combat, GAME_CONFIG.simulation.maxStep);
    this.combat = this.training.combat;
    this.vitals = new PlayerVitals(VITALS_CONFIG);
    this.skills = new SkillshotSystem(this.player.motion, this.training.lane.minions, this.vitals, DODGE_CONFIG);
    this.skillEffects = new SkillshotEffects(this);
    this.laneEffects = new LaneEffects(this);
    this.combatEffects = new CombatEffects(this);
    this.hud = new TrainingHud(difficulty => {
      this.skills.setDifficulty(difficulty);
      return this.skills.shotInterval;
    }, (kind, enabled) => {
      if (kind === 'minions') this.training.setMinionsEnabled(enabled);
      else this.skills.setEnabled(enabled);
    });
    this.playerInput = new PlayerInput(this, {
      stop: () => {
        this.combat.stop();
        this.markerAge = 1;
      },
      move: (point, freshClick) => {
        this.combat.moveTo(point);
        if (freshClick) {
          this.markerAge = 0;
          this.markerX = this.player.motion.target!.x;
          this.markerY = this.player.motion.target!.y;
        }
      },
      leftClick: (point, armed) => {
        this.combat.leftClick(point, armed);
      },
    });
    this.input.keyboard?.on('keydown-G', this.onGridKey);
    this.scale.on('resize', this.resize, this);
    this.events.once('shutdown', this.cleanup, this);
  }

  private resize(): void {
    const { width, height } = this.scale;
    const camera = this.cameras.main;
    // 固定单屏：完整容纳地图，不裁切、不追随角色、不向地图外滚动。
    camera.stopFollow();
    camera.setZoom(Math.min(width / GAME_CONFIG.world.width, height / GAME_CONFIG.world.height));
    camera.centerOn(GAME_CONFIG.world.width / 2, GAME_CONFIG.world.height / 2);
  }

  private onGridKey = (event: KeyboardEvent): void => { if (!event.repeat) this.toggleGrid(); };
  private toggleGrid = (): void => {
    this.gridVisible = !this.gridVisible;
    this.map.grid.setVisible(this.gridVisible);
  };

  update(_time: number, delta: number): void {
    if (!this.player) return;
    const rawDt = delta / 1000;
    const dt = Math.min(rawDt, GAME_CONFIG.simulation.maxFrameDelta);
    this.playerInput.update();
    const camera = this.cameras.main;
    // 每帧重新投影画布边角，缩放/窗口改变后屏外发射点仍在真实可见区域外。
    const topLeft = camera.getWorldPoint(0, 0);
    const bottomRight = camera.getWorldPoint(this.scale.width, this.scale.height);
    const view = { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
    this.training.update(dt, step => this.skills.step(step, view));
    this.player.updateVisuals(dt, this.combat.attack, this.vitals);
    const pointer = this.playerInput.pointerWorldPosition();
    const hovered = pointer && this.combat.pickTarget(pointer);
    this.playerInput.updateAttackCursor(hovered);
    const minions = this.training.lane.minions;
    const ids = new Set(minions.map(minion => minion.id));
    for (const [id, view] of this.minionViews) {
      if (!ids.has(id)) { view.destroy(); this.minionViews.delete(id); }
    }
    for (const minion of minions) {
      if (!this.minionViews.has(minion.id)) this.minionViews.set(minion.id, new MinionView(this, minion, MINION_CONFIG.deathSeconds));
      this.minionViews.get(minion.id)!.update(this.combat.activeTarget?.id === minion.id, hovered?.id === minion.id, GAME_CONFIG.combat.attackDamage);
    }
    this.laneEffects.update(this.training.lane);
    this.combatEffects.update(this.combat, this.playerInput.attackMoveArmed);
    this.skillEffects.update(this.skills);
    this.drawMoveFeedback(dt);
    this.hud.update(rawDt, this.player.motion, this.combat, this.playerInput.attackMoveArmed, this.training.lane, this.skills);
  }

  private drawMoveFeedback(dt: number): void {
    const model = this.player.motion;
    this.path.clear();
    if (model.target) {
      const dx = model.target.x - model.x;
      const dy = model.target.y - model.y;
      const distance = Math.hypot(dx, dy);
      this.path.fillStyle(0xa7d7bb, 0.18);
      // 上限避免长距离目的地引入无界绘制成本。
      const count = Math.min(60, Math.floor(distance / 24));
      for (let i = 2; i < count; i++) this.path.fillCircle(model.x + dx * i / count, model.y + dy * i / count, 1.2);
      this.path.lineStyle(1.5, 0xa2e4c0, 0.6).strokeCircle(model.target.x, model.target.y, 7);
      this.path.lineBetween(model.target.x - 11, model.target.y, model.target.x - 5, model.target.y);
      this.path.lineBetween(model.target.x + 5, model.target.y, model.target.x + 11, model.target.y);
      this.path.lineBetween(model.target.x, model.target.y - 11, model.target.x, model.target.y - 5);
      this.path.lineBetween(model.target.x, model.target.y + 5, model.target.x, model.target.y + 11);
    }
    this.markerAge += dt;
    this.marker.clear();
    if (this.markerAge < 0.55) {
      const progress = this.markerAge / 0.55;
      this.marker.lineStyle(2, 0x9be1b7, 1 - progress).strokeCircle(this.markerX, this.markerY, 8 + progress * 23);
      this.marker.lineStyle(1, 0xb7e8ca, (1 - progress) * 0.5).strokeCircle(this.markerX, this.markerY, 5 + progress * 14);
    }
  }

  private cleanup(): void {
    this.playerInput.destroy();
    this.hud.destroy();
    this.scale.off('resize', this.resize, this);
    this.input.keyboard?.off('keydown-G', this.onGridKey);
    this.minionViews.clear();
  }
}
