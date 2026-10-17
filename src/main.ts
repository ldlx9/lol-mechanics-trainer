import Phaser from 'phaser';
import { TrainingScene } from './scenes/TrainingScene';
import { mountSidebarToggle } from './ui/SidebarToggle';
import './styles.css';

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  backgroundColor: '#263d32',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  input: { mouse: { preventDefaultWheel: false } },
  // 第一阶段没有音效，也不初始化音频上下文。
  audio: { noAudio: true },
  scene: [TrainingScene],
});

// 即使仅居中位置变化、尺寸不变，也立即更新输入系统使用的画布边界。
const syncCanvas = (): void => {
  game.scale.getParentBounds();
  game.scale.refresh();
};
const disposeSidebar = mountSidebarToggle(syncCanvas);
// 数据栏切换不会触发 window.resize；同步画布尺寸与鼠标坐标投影。
const gamePanel = document.getElementById('game')!;
let panelWidth = 0;
let panelHeight = 0;
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = gamePanel.getBoundingClientRect();
  if (!game.isBooted || (width === panelWidth && height === panelHeight)) return;
  panelWidth = width;
  panelHeight = height;
  syncCanvas();
});
resizeObserver.observe(gamePanel);

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposeSidebar();
  resizeObserver.disconnect();
  game.destroy(true);
});
