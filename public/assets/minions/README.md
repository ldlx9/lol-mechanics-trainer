# 红蓝小兵像素素材

使用内置 imagegen 制作。近战以用户第一张大盾兜帽图为轮廓参考；远程以第二张镶边长袍施法图为参考。按用户要求采用更粗的大色块，去掉金属纹理、盾纹和复杂明暗；红方远程以最终蓝方远程做配色变换。

| 阵营 / 类型 | 使用文件 |
| --- | --- |
| 蓝方近战 | blue-melee.png |
| 红方近战 | red-melee.png |
| 蓝方远程 | blue-ranged.png |
| 红方远程 | red-ranged.png |

全部为透明背景单张姿势图，已接入 `src/minions/MinionView.ts`。显示高度近战 48、远程 46 世界单位；左右朝向翻转、行军起伏、前摇与受击反馈由代码驱动。血条保持独立深度 41，原有单位半径、道路导航、点选、攻速与伤害参数沿用。炮车保留程序模型。

原 PNG 均为 1254×1254；提示词里的 16×16 和六色是简化风格目标，并非文件物理分辨率或严格色数保证。通过脚底锚点和可见高度消除透明留白影响，使用最近邻采样。用户原图未修改或直接打包。

## 最终提示词（内置 imagegen，无 CLI 回退）

### blue-melee

参考：184022w0q44xaz5x000axf.webp

Use case: style-transfer. Create a TINY ULTRA-LOW-RESOLUTION GAME SPRITE, not a detailed pixel illustration. The user rejected previous attempts as far too detailed. STRICT DESIGN: a sprite drawn on a 16 by 16 logical-pixel grid, enlarged with NEAREST NEIGHBOR into big hard-edged uniform square blocks. Entire character only about 12 logical pixels wide and 14 logical pixels tall. Use ONLY SIX SOLID COLORS total: team color, dark team color, charcoal black, flat light gray/cream, white, brown. Each body part is only a handful of LARGE blocks. NO gradients, shading ramps, textures, highlights, thin outlines, decorations, metallic bevels, robe folds or tiny details. The supplied reference is ONLY for the broad character type and silhouette; DISCARD ALL its surface detail. This must look as simple as a 1980s 8-bit game mob: block hood, 3x3 black face with two single white square eye pixels, blocky robe/body and tiny feet. Square canvas with true alpha transparency and a small equal transparent border. One character, game-ready stance, facing slightly RIGHT. No text, ground, shadow, checkerboard, duplicates, grid lines or sprite sheet. BLUE MELEE: blue hood around black face, SIMPLE FLAT GRAY hood rim made of one-pixel-thick blocks, blue robe. Big plain gray DIAMOND shield on left foreground, solid dark-gray center with NO emblem or engraving. On right, one short brown stick topped by a SIMPLE 2x2 light-gray square block for the mace. The shield and mace must be simple icons. Six-color palette uses cobalt blue and navy for team colors. No silver texture, no fancy armor.

### red-melee

参考：184022w0q44xaz5x000axf.webp

Use case: style-transfer. Create a TINY ULTRA-LOW-RESOLUTION GAME SPRITE, not a detailed pixel illustration. The user rejected previous attempts as far too detailed. STRICT DESIGN: a sprite drawn on a 16 by 16 logical-pixel grid, enlarged with NEAREST NEIGHBOR into big hard-edged uniform square blocks. Entire character only about 12 logical pixels wide and 14 logical pixels tall. Use ONLY SIX SOLID COLORS total: team color, dark team color, charcoal black, flat light gray/cream, white, brown. Each body part is only a handful of LARGE blocks. NO gradients, shading ramps, textures, highlights, thin outlines, decorations, metallic bevels, robe folds or tiny details. The supplied reference is ONLY for the broad character type and silhouette; DISCARD ALL its surface detail. This must look as simple as a 1980s 8-bit game mob: block hood, 3x3 black face with two single white square eye pixels, blocky robe/body and tiny feet. Square canvas with true alpha transparency and a small equal transparent border. One character, game-ready stance, facing slightly RIGHT. No text, ground, shadow, checkerboard, duplicates, grid lines or sprite sheet. RED MELEE: crimson hood around black face, SIMPLE FLAT GRAY hood rim made of one-pixel-thick blocks, crimson robe. Big plain gray DIAMOND shield on left foreground, solid dark-gray center with NO emblem or engraving. On right, one short brown stick topped by a SIMPLE 2x2 light-gray square block for the mace. The shield and mace must be simple icons. Six-color palette uses crimson red and burgundy for team colors. No blue, no silver texture, no fancy armor.

### blue-ranged

参考：5d6034a85edf8db1ad5a64ef0223dd54574e74c0.jpg

Use case: style-transfer. Create a TINY ULTRA-LOW-RESOLUTION GAME SPRITE, not a detailed pixel illustration. The user rejected previous attempts as far too detailed. STRICT DESIGN: a sprite drawn on a 16 by 16 logical-pixel grid, enlarged with NEAREST NEIGHBOR into big hard-edged uniform square blocks. Entire character only about 12 logical pixels wide and 14 logical pixels tall. Use ONLY SIX SOLID COLORS total: team color, dark team color, charcoal black, flat light gray/cream, white, brown. Each body part is only a handful of LARGE blocks. NO gradients, shading ramps, textures, highlights, thin outlines, decorations, metallic bevels, robe folds or tiny details. The supplied reference is ONLY for the broad character type and silhouette; DISCARD ALL its surface detail. This must look as simple as a 1980s 8-bit game mob: block hood, 3x3 black face with two single white square eye pixels, blocky robe/body and tiny feet. Square canvas with true alpha transparency and a small equal transparent border. One character, game-ready stance, facing slightly RIGHT. No text, ground, shadow, checkerboard, duplicates, grid lines or sprite sheet. BLUE RANGED: blue triangular hood around black face, one-block-thick flat pale cream hood rim, SIMPLE blue trapezoid robe with a SINGLE straight cream stripe down front. Two short block arms stretched slightly out. Near hand holds one tiny blue square focus, NO glow or effects. Two black foot blocks. Six-color palette uses cobalt blue and navy. No shield, no mace, no staff decoration, no robe folds.

### red-ranged

参考：blue-ranged.png

Use case: precise-object-edit. Make a simple red-team version of this exact tiny pixel-art fantasy game minion. Change ONLY the blue and dark blue color blocks on its clothing and little handheld square to crimson red and dark burgundy blocks. Preserve every pixel-block shape, the same simple robe silhouette, the cream edging, dark face with white square eyes, dark hands and feet, scale, pose, right-facing direction, square canvas dimensions and transparent background. Keep the SAME low amount of detail and large square blocks. No new shading, no textures, no new objects, no text. Output one transparent PNG sprite.

