# 简化角色像素素材

根据用户提供的角色参考图制作，使用内置 imagegen。按用户要求采用更少的色块和细节，保留棕色双马尾、绿色蝴蝶结与服装、暗色大炮及橙色炮口。

| 状态 | 素材 |
| --- | --- |
| 静止站立 | idle-simple.png |
| 移动迈步 | move-simple.png |
| 跑步第二帧：收腿过渡 | move-simple-02.png |
| 跑步第三帧：换脚迈步 | move-simple-03.png |
| 跑步第四帧：第一侧迈腿过渡 | move-simple-04.png |
| 跑步第五帧：另一侧迈腿过渡 | move-simple-05.png |
| 攻击前摇：举炮蓄势、尚未发射 | windup-simple.png |

静止与前摇为单个动作姿势；移动现有五张独立帧，可循环，原素材朝向统一向右。输出 PNG 保留透明背景和放大的像素边缘。提示词中的 32×32 是简化设计目标，实际输出并非严格 32×32 像素或严格 12 色。

已接入训练场玩家模型。`src/config/playerVisuals.ts` 配置贴图、脚底锚点、显示高度与循环顺序；`src/entities/PlayerAnimation.ts` 根据实际移动速度和攻击状态推进动画。停止时站立，移动时循环跑步，前摇及短暂发射反馈使用举炮帧，取消前摇或后摇移动立即切回跑步。角色保持直立，根据移动模型朝向左右翻转；现有移动、攻击与命中参数沿用。前摇素材为一张姿势帧，进度由脚底原有前摇反馈显示。

`run-preview.html` 使用五张素材，播放顺序为 `1 → 4 → 2 → 5 → 3 → 5 → 2 → 4`，每步 70ms，完整循环 560ms。两侧跨步之间分别加入半收腿过渡，循环交界也经过过渡帧。所有图片解码后按经过时间切帧，支持暂停与继续。五张画布均为 1254×1254，上身与武器位置基本对应。通过 Vite 访问 `/assets/character/run-preview.html` 或直接打开该 HTML 即可查看。第三帧完整提示词见 `run-frame-03-prompt.md`，第 4、5 帧见 `run-frames-04-05-prompts.md`。

## 最终提示词（内置 imagegen，无 CLI 回退）

### 静止

Use case: style-transfer. Asset type: very simple tiny pixel-art game character, transparent PNG. Use the reference ONLY for the identity: dark brown twin-tail hair, two lime-green bows, green clothes, dark boots, large dark gray cannon with orange muzzle. The user specifically rejected the previous detailed rendering as having TOO MANY PIXELS AND DETAILS. Make this radically simpler: authentic 32x32 logical-pixel sprite, enlarged using hard nearest-neighbor square blocks, about 28 pixels tall and 28 pixels wide. Maximum 12 flat colors total, only one shadow tone per major color, tiny dot eyes, no hair strands, no clothing trim, no mechanical cannon detail. Big head and stubby body, large readable silhouettes, like a tiny classic handheld-game sprite, not a high-resolution pixel illustration. Three-quarter view facing RIGHT, slightly elevated top-down camera. Same full-body scale and identity in all poses, centered square canvas, feet baseline at 88% of canvas height, generous transparent margin. One character and one cannon only. True alpha transparency. No backdrop, no ground, no shadow, no text, no watermark, no frame or sprite sheet. Do not fire or show projectile or muzzle flash. Pose: IDLE. Both feet planted next to each other, body upright and relaxed, both hands holding the cannon horizontally at waist height aimed right. Hair hangs still. Keep pose simple.

### 移动

Use case: style-transfer. Asset type: very simple tiny pixel-art game character, transparent PNG. Use the reference ONLY for the identity: dark brown twin-tail hair, two lime-green bows, green clothes, dark boots, large dark gray cannon with orange muzzle. The user specifically rejected the previous detailed rendering as having TOO MANY PIXELS AND DETAILS. Make this radically simpler: authentic 32x32 logical-pixel sprite, enlarged using hard nearest-neighbor square blocks, about 28 pixels tall and 28 pixels wide. Maximum 12 flat colors total, only one shadow tone per major color, tiny dot eyes, no hair strands, no clothing trim, no mechanical cannon detail. Big head and stubby body, large readable silhouettes, like a tiny classic handheld-game sprite, not a high-resolution pixel illustration. Three-quarter view facing RIGHT, slightly elevated top-down camera. Same full-body scale and identity in all poses, centered square canvas, feet baseline at 88% of canvas height, generous transparent margin. One character and one cannon only. True alpha transparency. No backdrop, no ground, no shadow, no text, no watermark, no frame or sprite sheet. Do not fire or show projectile or muzzle flash. Pose: MOVING. One clear walking/running stride to the RIGHT, front leg extended forward and rear leg back, torso leaning forward slightly, both hands carrying the cannon aimed right, twin tails trailing slightly to the left. This is one single walking pose, not multiple animation frames.

### 攻击前摇

Use case: style-transfer. Asset type: very simple tiny pixel-art game character, transparent PNG. Use the reference ONLY for the identity: dark brown twin-tail hair, two lime-green bows, green clothes, dark boots, large dark gray cannon with orange muzzle. The user specifically rejected the previous detailed rendering as having TOO MANY PIXELS AND DETAILS. Make this radically simpler: authentic 32x32 logical-pixel sprite, enlarged using hard nearest-neighbor square blocks, about 28 pixels tall and 28 pixels wide. Maximum 12 flat colors total, only one shadow tone per major color, tiny dot eyes, no hair strands, no clothing trim, no mechanical cannon detail. Big head and stubby body, large readable silhouettes, like a tiny classic handheld-game sprite, not a high-resolution pixel illustration. Three-quarter view facing RIGHT, slightly elevated top-down camera. Same full-body scale and identity in all poses, centered square canvas, feet baseline at 88% of canvas height, generous transparent margin. One character and one cannon only. True alpha transparency. No backdrop, no ground, no shadow, no text, no watermark, no frame or sprite sheet. Do not fire or show projectile or muzzle flash. Pose: ATTACK WINDUP before firing. Feet planted wide, body leaning slightly backward in a braced stance, both hands raising and aiming the cannon horizontally to the RIGHT, shoulders pulled back in preparation. Small orange glow inside cannon mouth only, no shot, no muzzle flash, no projectile. This is preparation, not the firing or recoil pose.

