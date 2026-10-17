import Phaser from 'phaser';
import type { Point } from '../simulation/Movement';
import type { AttackTarget } from '../combat/AttackTarget';

interface InputHandlers {
  move: (point: Point, freshClick: boolean) => void;
  leftClick: (point: Point, attackMoveArmed: boolean) => void;
  stop: () => void;
}

/** 输入只下达世界坐标指令；A 是一次性指令状态，不是持续自动攻击开关。 */
export class PlayerInput {
  attackMoveArmed = false;
  private holding = false;
  private pointerInside = true;
  private attackCursorVisible = false;
  private readonly worldPoint = new Phaser.Math.Vector2();
  private readonly canvas: HTMLCanvasElement;

  constructor(private readonly scene: Phaser.Scene, private readonly handlers: InputHandlers) {
    this.canvas = scene.game.canvas;
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', this.pointerDown, this);
    scene.input.keyboard?.on('keydown-A', this.armAttackMove);
    scene.input.keyboard?.on('keydown-ESC', this.cancelAim);
    scene.input.keyboard?.on('keydown-S', this.stop);
    this.canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.canvas.addEventListener('pointerleave', this.pointerLeave);
    this.canvas.addEventListener('pointerenter', this.pointerEnter);
    window.addEventListener('pointerup', this.release);
    window.addEventListener('blur', this.release);
    document.addEventListener('visibilitychange', this.visibilityChange);
  }

  private preventContextMenu = (event: Event): void => event.preventDefault();
  private pointerLeave = (): void => { this.pointerInside = false; this.updateAttackCursor(null); };
  private pointerEnter = (event: PointerEvent): void => {
    this.pointerInside = true;
    if ((event.buttons & 2) === 0) this.holding = false;
  };
  private release = (event?: PointerEvent | FocusEvent): void => {
    if (event instanceof PointerEvent && (event.buttons & 2) !== 0) return;
    this.holding = false;
    if (event instanceof FocusEvent) this.cancelAim();
  };
  private armAttackMove = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    this.holding = false;
    this.attackMoveArmed = true;
  };
  private cancelAim = (): void => { this.attackMoveArmed = false; this.updateAttackCursor(null); };
  private stop = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    this.holding = false;
    this.cancelAim();
    this.handlers.stop();
  };
  private visibilityChange = (): void => {
    if (document.hidden) { this.holding = false; this.cancelAim(); }
  };
  private pointerDown(pointer: Phaser.Input.Pointer): void {
    // 使用这次按下的键，而非“是否仍按住右键”；两键同时按下时左键仍能锁定目标。
    if (pointer.button === 2) {
      this.cancelAim();
      this.holding = true;
      this.issueMove(pointer, true);
    } else if (pointer.button === 0) {
      this.holding = false;
      this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.worldPoint);
      this.handlers.leftClick({ x: this.worldPoint.x, y: this.worldPoint.y }, this.attackMoveArmed);
      this.cancelAim();
    }
  }

  pointerWorldPosition(): Point | null {
    if (!this.pointerInside) return null;
    const pointer = this.scene.input.activePointer;
    this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.worldPoint);
    return { x: this.worldPoint.x, y: this.worldPoint.y };
  }

  /** 与点选共用悬停目标；仅 A 待命且命中存活敌方单位时切换准星。 */
  updateAttackCursor(target: AttackTarget | null): void {
    const visible = this.attackMoveArmed && this.pointerInside && !!target?.alive && target.team === 'red';
    if (visible === this.attackCursorVisible) return;
    this.attackCursorVisible = visible;
    this.canvas.classList.toggle('attack-target-cursor', visible);
  }

  /** 每帧按当前固定视窗投影，窗口缩放后也不使用陈旧的 worldX/worldY。 */
  update(): void {
    if (!this.holding || !this.pointerInside) return;
    this.issueMove(this.scene.input.activePointer, false);
  }

  private issueMove(pointer: Phaser.Input.Pointer, freshClick: boolean): void {
    this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.worldPoint);
    this.handlers.move({ x: this.worldPoint.x, y: this.worldPoint.y }, freshClick);
  }

  destroy(): void {
    this.cancelAim();
    this.scene.input.off('pointerdown', this.pointerDown, this);
    this.scene.input.keyboard?.off('keydown-A', this.armAttackMove);
    this.scene.input.keyboard?.off('keydown-ESC', this.cancelAim);
    this.scene.input.keyboard?.off('keydown-S', this.stop);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.canvas.removeEventListener('pointerenter', this.pointerEnter);
    window.removeEventListener('pointerup', this.release);
    window.removeEventListener('blur', this.release);
    document.removeEventListener('visibilitychange', this.visibilityChange);
  }
}
