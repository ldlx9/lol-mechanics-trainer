# 弹道素材

使用内置 imagegen 处理用户提供的三张图片，输出真实透明 PNG。没有使用 CLI/API 回退。源文件保持不变。

| 游戏类型 | 文件 | 用户原图 |
| --- | --- | --- |
| 紫色穿透 | piercing.png | 紫色魔法箭矢动画条.png |
| 红焰长矛 | spear.png | 像素红焰长矛飞袭.png |
| 蓝色能量 | energy.png | 蓝色冰能弹像素动画序列.png |

三张输入均按单张素材使用。紫色箭矢按用户确认的朝向，以素材左端为弹头并加 180° 旋转校正；另外两张以右端为弹头。显示时按实际飞行方向旋转，并让各自弹头锚点与模拟坐标重合。裁切只选择纹理帧，原 PNG 的 alpha 保留。显示长度 140 / 100 / 80 世界单位。现有速度、判定宽度、伤害与命中规则不变。

## 最终处理提示词（background-extraction）

### piercing

Edit the supplied purple magic arrow into one production-ready transparent PNG game projectile sprite. Preserve the exact recognizable pixel-art purple/white arrow, straight long thin shaft, pointed right-facing head, magical purple sparks and glow. Remove ALL black background to true alpha transparency. Single arrow only, horizontally pointing RIGHT (+X), centered vertically, with a small transparent margin on each side. No text, no ground, no frame, no checkerboard, no extra sprites, no sprite sheet. Keep crisp pixels and purple glow; do not redesign. Crop the canvas close to the whole projectile including its luminous trail, use a wide landscape aspect ratio about 5:1.

### spear

Extract the ONE flying red-fire spear from the reference as a transparent PNG game sprite. Preserve the recognizable pixel-art long dark spear shaft, pointed silver spearhead facing RIGHT (+X), vivid red-orange flames and curling red ribbons/petals trailing to the left. Remove ALL green/brown/gray map terrain and rocks to real alpha transparency, including gaps between ribbons. Keep the entire spear and attached fiery trails. Single projectile horizontally right-facing, centered vertically on a wide landscape canvas about 5:1 with only a small transparent outer margin. No background, no ground, no text, no frame, no checkerboard, no extra objects or sprite sheet. Retain crisp pixel-art identity and avoid inventing new ornament.

### energy

Edit this one blue/cyan icy energy bolt into one transparent PNG game projectile sprite. Remove ALL black background to real alpha transparency. Rotate the bolt so its bright white-cyan rounded pointed HEAD is on the RIGHT, and its blue fragmented streak TAIL extends LEFT, horizontally aligned (+X flight). Preserve original recognizable bright white cyan head, blue pixel fragments, crisp pixel art and glow. Single projectile only, no animation sheet, no duplicate, no text, no checkerboard, no ground. Closely frame all the bolt with a small transparent margin, landscape aspect ratio about 2.5:1. Do not redesign or add elements.

