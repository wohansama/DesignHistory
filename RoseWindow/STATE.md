# Rose Window — 项目状态文件

## 当前里程碑
**M6 — Information Panel（信息面板）**

## 环境信息
- Three.js 版本：0.185.1
- http-server 版本：14.1.1
- 开发服务器：http-server
- 启动命令：`npx http-server -p 8080 -c-1 --cors`（或 `npm start`）
- 访问地址：http://127.0.0.1:8080

## 全局要求覆盖说明（项目全局要求.txt）
当前版本场景**仅包含白色地板 + 玫瑰窗**，不实现天花板和四面墙。
不提前实现未来里程碑的功能。

## 任务状态

| 任务 | 描述 | 状态 | 备注 |
|------|------|------|------|
| Task 2.1 | 创建展厅（白色地板 + 玫瑰窗） | ✅ | M2 完成 |
| Task 2.2 | 创建光照 | ✅ | M2 完成 |
| Task 3.1 | 第一人称控制器 | ✅ | M3 完成 |
| Task 3.2 | 移动范围限制 | ✅ | M3 完成 |
| Task 4.1 | 加载玫瑰窗资源 | ✅ | 复用 M2 已加载的 GLB |
| Task 4.2 | 生成光点+存原位 | ✅ | MeshSurfaceSampler 采样两 mesh，世界空间 |
| Task 4.3 | 待机动画 | ✅ | 顶点着色器 sin 波沿法线呼吸 |
| Task 4.4 | 距离检测 | ✅ | JS + 着色器双端计算，每帧更新 |
| Task 4.5 | 光点偏移 | ✅ | 法线主分量+远离玩家小分量，高斯空间权重 |
| Task 4.6 | 恢复行为 | ✅ | M4 完成 |
| Task 5.1 | 创建5个信息节点 | ✅ | 5个发光球体围绕窗边缘，不挡中心 |
| Task 5.2 | 依次淡入 | ✅ | exploration状态触发，stagger 0.15s 逐个淡入 |
| Task 5.3 | 点击检测 | ✅ | 准星射线+click选中，供M6读取 |
| Task 6.1 | 玻璃拟态UI | ✅ | DOM overlay，backdrop-filter blur+半透明+圆角+阴影 |
| Task 6.2 | 加载信息 | ✅ | 5主题内容(色彩/光/建筑/工艺/历史)，选中节点填充 |
| Task 6.3 | 关闭交互 | ✅ | 点击空白关闭+走远自动关闭+ESC关闭 |

## 已完成

### M4 — Interactive Light Point System

#### 核心架构
玫瑰窗从"实体 GLB 模型"转变为"由 5 万个发光光点构成的光之玫瑰窗"。GLB 降级为采样数据源——采样完几何和颜色后实体模型隐藏，光点独立成为作品本身（技术规格 §4.2）。全部位移/动画/恢复逻辑在 GPU 顶点着色器内完成，CPU 端每帧零计算。

#### 新建文件
- **`src/lightpoints/TextureColorSampler.js`**：CPU 端贴图颜色查找器
  - 把 `material.map.image` 画到 canvas → getImageData → 按 UV 查像素
  - Y 翻转 + repeat 包裹处理
  - sRGB→线性转换（three.js color management 假定 buffer 为线性）
  - MeshSurfaceSampler 不读贴图色，用此模块通过 UV 间接取色
- **`src/lightpoints/PointShader.js`**：GLSL 顶点+片元着色器
  - 顶点：距离→smoothstep 强度、高斯空间权重、法线+远离玩家位移、sin 呼吸、gl_PointSize 透视衰减
  - 片元：圆形裁剪、软边、中心增亮、AdditiveBlending 友好
- **`src/lightpoints/LightPointSystem.js`**：光点系统主控制器
  - `generate()`：从 RoseWindow_Glass(70%) + RoseWindow_Frame(30%) 采样，世界空间变换，单 BufferGeometry + ShaderMaterial + THREE.Points
  - `update(dt, playerPos)`：推 uniforms（uPlayerPos/uTime）+ 算距离
  - `getDistance()` / `getState()`：供 M5 信息节点用

#### 修改文件
- `src/config/Config.js`：新增 `lightPoints` 配置段（totalCount/meshSampling/point/idle/interaction/blending/hidePhysicalModel）
- `src/core/Application.js`：集成光点系统
  - `_initLightPoints()`：生成后隐藏实体模型
  - `_update(dt)`：player.update 后调用 lightPoints.update
  - dispose 加入清理

#### 关键技术决策
1. **颜色采样**：MeshSurfaceSampler 只读顶点色（GLB 没有），改用采 UV + CPU 查贴图像素
2. **世界空间采样**：RoseWindowModel 把变换直接施加在 gltf.scene 上，必须在放置后 updateMatrixWorld(true) 再用 matrixWorld 变换
3. **位移方向**（用户确认）：`dir = normalize(aNormal) + 0.25 × normalize(position − uPlayerPos)`，法线跟随 3D 曲面，远离玩家制造"礼让"感
4. **GPU 全包**：50K 点的位移/强度/呼吸/恢复全在顶点着色器，60fps 无压力
5. **AdditiveBlending**：光点叠加发光，Frame 暗色自然弱化不喧宾夺主
6. **sRGB→线性**：canvas 读出 sRGB 字节，存 aColor 前 convertSRGBToLinear，避免最终偏亮偏饱和

#### 交互行为映射（交互规范 §6）
- **S0 观察（>8m）**：强度=0，仅微妙呼吸（振幅 0.012m ≈ 半径 0.6%）
- **S1 靠近（3-8m）**：smoothstep 强度 0→1，附近点（高斯 σ=1.8m）沿法线+远离玩家位移，轮廓保持
- **S2 探索（<3m）**：位移达上限 0.28m（≈半径 14%）
- **恢复**：玩家走远，强度连续→0，位移自然回零（无瞬变）

### M4 优化 — 光感强化与粒子增密（用户反馈后迭代）
用户反馈：轮廓✓颜色✓位移✓，但发光感弱、不像光粒、粒子不足。优化如下：
- [x] **粒子 5万→10万**：`totalCount` 50000→100000
- [x] **片元着色器重写**：高斯软边 `exp(-dist²×14)` 长尾光晕；中心增亮溢出 `brightness=1+core×uCoreBoost`（默认×3），加法混合下亮核堆向白色
- [x] **新增 uCoreBoost uniform**（默认 2.0）→ LightPointSystem + PointShader
- [x] **点变大**：size 0.03→0.055；opacity 0.9→1.0
- [x] **Bloom 后处理**：新建 `src/core/PostProcessing.js`（EffectComposer+RenderPass+UnrealBloomPass+OutputPass）；strength=0.65/radius=0.5/threshold=0.12（只让加法堆出的亮核 bloom）
- [x] **渲染管线改造**：RenderLoop 支持 composer 分支；ResizeHandler 同步 composer 尺寸；Application 集成
- [x] **tone mapping 去重**：EffectComposer 渲染到 renderTarget 时 renderer 强制 NoToneMapping，OutputPass 末端读 renderer 设置应用一次，不重复
- [x] **地板浅灰**：0xffffff→0xccccc（降低反射衬托光粒）
- [x] **灯光小幅调低**：ambient 0.35→0.22、directional 0.9→0.6、hemisphere 0.25→0.15、HDR env 0.6→0.4

### M4 调参迭代（曝光修复）
首版优化后严重过曝+丢色。根因：加法混合累积 ≈22×（2×点数 × 3.36×大点 × 3×增亮 × 1.1×opacity）。修复：
- [x] **取消中心增亮溢出**：coreBoost 2.0→0.0（加法累积已自然出亮，无需单点增亮）
- [x] **模型 1.5 倍**：targetSize 4.0→6.0（铺开降密度）
- [x] **降 opacity**：1.0→0.35（控制加法累积，回到合理曝光——大柔低透明点叠出亮核）
- [x] **Bloom 减弱**：strength 0.65→0.3、threshold 0.12→0.25（只让真亮区 bloom）
- 修复后总累积 ≈1.16× 优化前水平：颜色忠于原作 + 大柔光点 + 亮核辉光

### M4 调参迭代 2（选择性 Bloom + 独立粒子数）
- [x] **选择性 Bloom**：地板零 Bloom，粒子有 Bloom。技术：渲染 Bloom 前把所有 Mesh 材质换黑（Points 不受影响），Bloom 后恢复，再正常渲染全场景叠上。重写 PostProcessing.js
- [x] **独立粒子数**：meshSampling 从权重改为每 mesh 独立 count。Glass 120000 / Frame 30000（总 15 万），可单独调玻璃不影响框架
- [x] RenderLoop 改用 renderFn 回调（替代 composer）适配选择性 Bloom 的双阶段渲染

### M5 — Information Node System

#### 新建文件
- **`src/info-nodes/InfoNodeSystem.js`**：信息节点系统
  - `createNodes()`：5个发光球体（radius 0.12m，MeshStandardMaterial + emissive），围绕窗边缘 z=+0.8
  - `update(dt, playerState)`：状态驱动淡入/淡出 + 准星射线悬停 + 脉冲呼吸
  - `onClick()`：选中当前高亮节点，存 selectedNode 供 M6
  - 射线：`raycaster.setFromCamera(Vector2(0,0), camera)` 屏幕中心，`ray.distanceToPoint` 判定命中
- **准星 UI**：`index.html` + `main.css` 加 `#crosshair`（.visible/.hover 状态）

#### 修改文件
- `Config.js`：新增 `infoNodes` 段（5节点位置+title、外观、淡入时序、射线半径）
- `Application.js`：_initInfoNodes() 集成 + _update 调用 infoNodes.update + click 事件升级（locked→选节点，unlocked→re-lock）+ dispose

#### 交互行为
- **S2 探索（<3m）**：5节点依次淡入（stagger 0.15s，每节点 0.4s），准星出现
- **悬停**：准星瞄准节点 → 节点放大 1.4× + emissive 增强 1.5×，准星变蓝色圆环
- **点击**：选中节点 → log + 存 selectedNode（M6 将打开面板）
- **离开（>8m）**：节点反序淡出，准星消失

#### 节点位置（围绕窗心 (0,3,0)，z=+0.8 前置）
| 节点 | 位置 | 主题 |
|------|------|------|
| Color | (3.8, 3.0, 0.8) | 色彩 |
| Light | (2.4, 5.0, 0.8) | 光 |
| Architecture | (-2.4, 5.0, 0.8) | 建筑 |
| Craftsmanship | (-3.8, 3.0, 0.8) | 工艺 |
| History | (0, 1.2, 0.8) | 历史 |

### M6 — Information Panel

#### 新建文件
- **`src/info-panel/panel-content.js`**：5主题内容数据（色彩/光/建筑/工艺/历史），每条含 title+banner颜色+description（玫瑰窗文化内容2-3段）
- **`src/info-panel/InfoPanel.js`**：DOM面板控制器
  - `open(content, id)`：填充标题/横幅/描述，添加 .visible 类触发滑入动画
  - `close()`：移除 .visible 类
  - `isOpen()` / `getCurrentId()`

#### 修改文件
- `index.html`：新增 `#info-panel` DOM（banner + body + title + description + hint）
- `styles/main.css`：玻璃拟态面板样式（右侧固定定位、backdrop-filter blur 20px、半透明白底、圆角18px、柔阴影、slide-in 动画）
- `src/core/Application.js`：
  - `onSelect` → `infoPanel.open(PANEL_CONTENT[data.id])`
  - click handler 升级：悬停节点→选中(开/换面板)；未悬停+面板开→关闭面板
  - `_update`：面板开+非exploration状态→自动关闭
  - `onUnlock`（ESC）→关闭面板

#### 交互流程
```
选中节点(瞄准+click) → 面板从右侧滑入，显示标题+彩色横幅+描述
点击空白处(未悬停节点) → 关闭面板
选中另一节点 → 替换内容(单面板)
走出探索距离(>9m) → 自动关闭
按ESC(退出pointer lock) → 关闭面板
```

### 先前里程碑
- **M3**：第一人称控制器（PointerLockControls + WASD 平滑阻尼 + 边界 clamp）
- **M2**：白色地板 + GLB 模型 + 三层光照 + HDR 环境 + ResourceManager
- **M1**：项目框架 + 渲染基础

## 服务器端验证结果
- ✅ http-server 正常运行在 http://127.0.0.1:8080
- ✅ M4 新增文件全部 HTTP 200：
  - TextureColorSampler.js、PointShader.js、LightPointSystem.js
  - Config.js、Application.js、MeshSurfaceSampler.js、index.html
- ✅ 所有 M4 JS 文件通过 `node --check` 语法检查

## 浏览器端验证清单（请在浏览器中确认）

### Task 4.1/4.2 — 光点生成
- [ ] Console 出现 `[LightPointSystem] Generated 50000 points across 2 mesh(es). Meshes: RoseWindow_Glass, RoseWindow_Frame`
- [ ] Console 出现 `[M4] Physical model hidden — light points are the artwork.`
- [ ] 实体 GLB 模型消失，取而代之的是光点云
- [ ] 光点构成玫瑰窗的放射状轮廓（可辨识）
- [ ] 玻璃区光点彩色（忠于原作色彩），窗框区光点偏暗

### Task 4.3 — 待机动画
- [ ] 远观（>8m）光点有极微妙的呼吸浮动（沿法线方向轻颤）
- [ ] 呼吸幅度极小，不破坏轮廓稳定性

### Task 4.4/4.5 — 距离检测与光点偏移
- [ ] 走近到 3-8m：靠近玩家那一侧的光点开始沿法线+远离玩家方向位移
- [ ] 位移随距离减小而平滑增大
- [ ] 只有附近的点显著响应（远端点几乎不动）
- [ ] 玫瑰窗整体轮廓始终可辨识
- [ ] 贴近到 <3m：位移达到上限，点轻微"浮起"但未散落

### Task 4.6 — 恢复
- [ ] 走远后光点平滑回到原位（约 2 秒内）
- [ ] 恢复过程无瞬变、无抖动
- [ ] 回到 >8m 后只剩呼吸动画

### 通用
- [ ] 60 FPS 流畅
- [ ] 光点有发光感（叠加明亮，非实体碎屑感）
- [ ] 窗口缩放正常

## 已知问题
- （暂无，待浏览器验证）

## 调试提示
- 光点太密/太稀：调 `CONFIG.lightPoints.totalCount`（30K~80K）
- 点太大/太小：调 `CONFIG.lightPoints.point.size`
- 位移太强/太弱：调 `interaction.maxDisplacement`（半径 10-15%）
- 响应范围：调 `interaction.interactionRadius`（S1 起始）/ `explorationRadius`（S2 起始）
- 响应太局部/太全局：调 `interaction.spatialFalloff`（高斯 σ）
- 远离玩家分量：调 `interaction.playerAvoidWeight`
- 呼吸幅度：调 `idle.amplitude`（应保持"视觉可忽略"）
- 若颜色偏亮偏饱和：检查 sRGB→线性转换是否生效
- 若想看实体模型+光点共存：`CONFIG.lightPoints.hidePhysicalModel = false`

## 下一步
- M5：信息节点系统
  - Task 5.1：创建五个信息节点（围绕作品布置）
  - Task 5.2：依次淡入（进入探索状态后）
  - Task 5.3：点击检测（打开信息面板）
  - 依赖 M4 的 `getDistance()` / `getState()` 判断交互状态
- M6：信息面板（玻璃拟态 UI）
