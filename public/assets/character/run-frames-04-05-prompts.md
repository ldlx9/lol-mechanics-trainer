# 跑步补间帧 04 / 05

使用内置 imagegen，分别以相邻两张已有图片为参考。保留上身、朝向、配色与透明背景，主要调整双腿姿势。原三张素材未修改。

- 第 4 帧：`move-simple-04.png`，在原第 1 帧与第 2 帧之间。
- 第 5 帧：`move-simple-05.png`，在原第 2 帧与第 3 帧之间。

## 最终提示词

### 第 04 帧

参考：move-simple.png，move-simple-02.png

Use case: precise-object-edit. Asset type: ONE intermediate running animation frame, transparent PNG, matching an existing simple pixel-art character. Two references are adjacent poses of the SAME sprite; interpolate only the legs between them. LOCK the upper body to reference image 1: head, eyes, mouth, bows, hair, shoulders, hands and dark cannon with orange muzzle must keep the same exact shapes, positions, size and colors. Do not add detail or change the simple chunky square pixel clusters. Same right-facing camera view, same 1254x1254 square framing and alpha background, same sprite scale, same hips and ground baseline. Only animate the legs below the green skirt, and at most one logical pixel of skirt movement. Full character visible, no text, no ground, no shadow, no effects, no projectile, no extra figure or frame sheet. Image 1 is a wide stride: left-side boot raised behind, right-side boot stretched down-right. Image 2 is a narrow passing pose with both knees close under the hips. Produce the HALFWAY TRANSITION: the left-side boot has swung partway inward and slightly lower; the right-side leg is partly pulled inward with a gently bent knee. Feet separation should be about HALF of image1, clearly MORE open than image2 and LESS open than image1. The left boot stays visibly higher than the right boot. Do NOT copy either reference pose. This frame should blend the exact sequence wide-stride image1 -> NEW halfway pose -> compact image2. Preserve the face and cannon perfectly, no horizontal flip.

### 第 05 帧

参考：move-simple-03.png，move-simple-02.png

Use case: precise-object-edit. Asset type: ONE intermediate running animation frame, transparent PNG, matching an existing simple pixel-art character. Two references are adjacent poses of the SAME sprite; interpolate only the legs between them. LOCK the upper body to reference image 1: head, eyes, mouth, bows, hair, shoulders, hands and dark cannon with orange muzzle must keep the same exact shapes, positions, size and colors. Do not add detail or change the simple chunky square pixel clusters. Same right-facing camera view, same 1254x1254 square framing and alpha background, same sprite scale, same hips and ground baseline. Only animate the legs below the green skirt, and at most one logical pixel of skirt movement. Full character visible, no text, no ground, no shadow, no effects, no projectile, no extra figure or frame sheet. Image 1 is the opposite wide stride: left-side boot down-left near ground, right-side boot raised and bent on the right. Image 2 is the narrow passing pose with both knees close under the hips. Produce the HALFWAY TRANSITION between image2 and image1: the left leg extends partway down-left with a gently bent knee, the right knee lifts partway up-right. Feet separation should be about HALF of image1, clearly MORE open than image2 and LESS open than image1. The LEFT boot is visibly LOWER than the right boot, the opposite leg phase from the first wide-stride run. Do NOT copy either reference pose. This frame should blend compact image2 -> NEW halfway pose -> opposite wide-stride image1. Preserve the face and cannon perfectly, no horizontal flip.

