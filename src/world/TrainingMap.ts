import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { ROAD_CONFIG } from '../config/road';
import { RoadCorridor } from '../simulation/RoadCorridor';

const WORLD = GAME_CONFIG.world;
const ROAD = new RoadCorridor(ROAD_CONFIG, WORLD);

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function laneDistance(x: number, y: number): number {
  return ROAD.signedDistance({ x, y });
}

/** 原创地图：分块烘焙为 Canvas 纹理，不下载或使用官方美术。装饰无碰撞。 */
export class TrainingMap {
  readonly grid: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    const chunk = WORLD.chunkSize;
    for (let row = 0; row < Math.ceil(WORLD.height / chunk); row++) {
      for (let col = 0; col < Math.ceil(WORLD.width / chunk); col++) {
        const width = Math.min(chunk, WORLD.width - col * chunk);
        const height = Math.min(chunk, WORLD.height - row * chunk);
        const key = `ground-${col}-${row}`;
        const texture = scene.textures.createCanvas(key, width, height);
        if (!texture) throw new Error('无法创建地图 Canvas 纹理');
        const ctx = texture.context;
        const ox = col * chunk;
        const oy = row * chunk;
        const rng = random(col * 2311 + row * 7741 + 42);
        ctx.fillStyle = '#263d32';
        ctx.fillRect(0, 0, width, height);

        // 柔和草地斑块。
        for (let i = 0; i < 85; i++) {
          const x = rng() * width;
          const y = rng() * height;
          const radius = 15 + rng() * 85;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, rng() > 0.5 ? '#52604435' : '#142f2a55');
          gradient.addColorStop(1, '#263d3200');
          ctx.fillStyle = gradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        ctx.save();
        ctx.translate(-ox, -oy);
        // 斜向固定世界路线：两侧苔藓与中间石板。
        ctx.lineCap = 'round';
        const startX = -400;
        const endX = WORLD.width + 400;
        const lineY = (x: number) => ROAD_CONFIG.center.y - (x - ROAD_CONFIG.center.x) * ROAD_CONFIG.slope;
        for (const [lineWidth, color] of [[ROAD_CONFIG.mossWidth, '#3c4b35'], [ROAD_CONFIG.shoulderWidth, '#4b513e'], [ROAD_CONFIG.halfWidth * 2, '#4a4e44']] as const) {
          ctx.beginPath();
          ctx.moveTo(startX, lineY(startX));
          ctx.lineTo(endX, lineY(endX));
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        // 全局坐标哈希，跨分块石板保持连续。
        for (let gy = Math.floor((oy - 80) / 62); gy < (oy + height + 80) / 62; gy++) {
          for (let gx = Math.floor((ox - 100) / 92); gx < (ox + width + 100) / 92; gx++) {
            const tileRandom = random(gx * 1787 + gy * 9811 + 9191);
            const x = gx * 92 + (gy % 2) * 42;
            const y = gy * 62;
            const distance = Math.abs(laneDistance(x + 40, y + 25));
            if (distance > ROAD_CONFIG.halfWidth - ROAD_CONFIG.edgeInset || tileRandom() < 0.07) continue;
            const tint = Math.floor(tileRandom() * 13);
            ctx.fillStyle = `rgb(${78 + tint},${83 + tint},${71 + tint})`;
            ctx.strokeStyle = '#303e34';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + 7, y + 7);
            ctx.lineTo(x + 66 + tileRandom() * 15, y + 3);
            ctx.lineTo(x + 85, y + 36);
            ctx.lineTo(x + 62, y + 56);
            ctx.lineTo(x + 5, y + 49);
            ctx.lineTo(x - 3, y + 24);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#a4a98a25';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 10);
            ctx.lineTo(x + 65, y + 6);
            ctx.stroke();
            if (tileRandom() > 0.65) {
              ctx.strokeStyle = '#303d3466';
              ctx.beginPath();
              ctx.moveTo(x + 22, y + 9);
              ctx.lineTo(x + 35, y + 29);
              ctx.lineTo(x + 30, y + 50);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
        // 稀疏草叶，地面噪点。
        for (let i = 0; i < 950; i++) {
          const x = rng() * width;
          const y = rng() * height;
          const onLane = Math.abs(laneDistance(ox + x, oy + y)) < 220;
          ctx.fillStyle = onLane ? '#b1b08a0b' : (rng() > 0.5 ? '#8b9e6430' : '#102b2535');
          ctx.fillRect(x, y, onLane ? 2 : 1, onLane ? 1 : 2 + rng() * 5);
        }
        texture.refresh();
        scene.add.image(ox, oy, key).setOrigin(0).setDepth(-100);
      }
    }
    this.createDecorations(scene);
    this.grid = scene.add.graphics().setDepth(-5);
    this.grid.lineStyle(1, 0xb3c49c, 0.07);
    for (let x = 0; x <= WORLD.width; x += WORLD.gridSize) this.grid.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += WORLD.gridSize) this.grid.lineBetween(0, y, WORLD.width, y);
    const boundary = scene.add.graphics().setDepth(-4);
    boundary.lineStyle(6, 0xc0ae75, 0.5).strokeRect(3, 3, WORLD.width - 6, WORLD.height - 6);
    const center = scene.add.graphics().setDepth(-4);
    const cx = WORLD.width / 2;
    const cy = WORLD.height / 2;
    center.lineStyle(2, 0xc3bc92, 0.17);
    center.strokePoints([{ x: cx, y: cy - 50 }, { x: cx + 65, y: cy }, { x: cx, y: cy + 50 }, { x: cx - 65, y: cy }], true);
    center.lineBetween(cx - 85, cy, cx - 65, cy).lineBetween(cx + 65, cy, cx + 85, cy);
    for (const [x, y, label] of [[cx - 480, cy + 280, '西南 · SOUTHWEST'], [cx + 480, cy - 280, '东北 · NORTHEAST']] as const) {
      scene.add.text(x, y, label, { fontFamily: 'sans-serif', fontSize: '12px', color: '#c1c1a0' })
        .setOrigin(0.5).setAlpha(0.26).setDepth(-4);
    }
  }

  private createDecorations(scene: Phaser.Scene): void {
    const rng = random(702);
    const graphics = scene.add.graphics().setDepth(-20);
    for (let i = 0; i < 190; i++) {
      const x = 60 + rng() * (WORLD.width - 120);
      const y = 60 + rng() * (WORLD.height - 120);
      if (Math.abs(laneDistance(x, y)) < 350) continue;
      const size = 16 + rng() * 28;
      graphics.fillStyle(0x102b25, 0.3).fillEllipse(x + 10, y + 12, size * 2.6, size * 1.6);
      if (rng() > 0.35) {
        graphics.fillStyle(0x19382e).fillCircle(x, y, size);
        graphics.fillStyle(0x2c4937).fillCircle(x - size * 0.2, y - size * 0.23, size * 0.8);
        graphics.fillStyle(0x39553d, 0.65).fillCircle(x - size * 0.25, y - size * 0.4, size * 0.5);
      } else {
        graphics.fillStyle(0x344841).fillPoints([
          { x: x - size, y: y + 4 }, { x: x - size * 0.7, y: y - size * 0.7 },
          { x: x + size * 0.4, y: y - size }, { x: x + size, y: y + 5 }, { x, y: y + size * 0.6 },
        ], true);
        graphics.lineStyle(2, 0x718176, 0.2).lineBetween(x - size * 0.7, y - size * 0.7, x + size * 0.4, y - size);
      }
    }
    // 原创路标灯；仅为静态装饰，没有塔或战斗行为。
    const count = Math.floor(WORLD.width / 2 / 470);
    for (let i = -count; i <= count; i++) {
      const x = WORLD.width / 2 + i * 470;
      const y = ROAD_CONFIG.center.y - i * 470 * ROAD_CONFIG.slope;
      for (const side of [-1, 1]) {
        const px = x + side * 128;
        const py = y + side * 220;
        graphics.fillStyle(0x0d241e, 0.5).fillEllipse(px + 5, py + 8, 47, 28);
        graphics.fillStyle(0x4c5b4c).fillCircle(px, py, 18);
        graphics.lineStyle(2, 0x7b8667, 0.5).strokeCircle(px, py, 13);
        graphics.fillStyle(0xd0bc78, 0.04).fillCircle(px, py, 49);
        graphics.fillStyle(0xd0bc78, 0.08).fillCircle(px, py, 28);
        graphics.fillStyle(0xd8c282, 0.85).fillCircle(px, py, 5);
      }
    }
  }
}
