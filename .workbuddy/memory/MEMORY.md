# 设计史作业 — 项目记忆

## 项目概况
- **课程**：大学设计史
- **作品名**：玫瑰窗·光之生成（Rose Window · Generation of Light）
- **文物**：巴黎圣母院玫瑰窗
- **数字作品类型**：Unity 3D 生成式数字艺术
- **最终提交**：6月30日
- **报告提交**：约6月5日（下周五）

## 技术选型
- Unity 2021/2022 LTS + URP
- 核心：C# 程序化生成 + HLSL Compute Shader
- 递进策略：先做完任务一（完整作业），再叠加光线系统（三段式）

## 阶段 1 开发（6月26日）
- **状态**：代码完成，待用户在 Unity Editor 中搭建场景测试
- **项目路径**：`RoseWindowProject/`
- **已创建**：WindowParams.cs、WindowGenerator.cs、Colorizer.cs、LightProjector.cs、WindowMask.shader、LightProjection.shader
- **关键接口**：遮罩纹理 R8（1.0=实体/挡光，0.0=镂空/透光），颜色纹理 ARGB32
- **Shader 全局变量**：_WindowMask, _WindowColor, _WindowCenter, _WindowNormal, _WindowRadius, _MainLightDirection
- **搭建文档**：SETUP.md, URP_SETUP.md, SCENE_SETUP.md, MATERIAL_SETUP.md
- **场景布局**：窗 Quad(0,5,0)，Directional Light angle~35°向下，地面接收面(0,0,0)，后墙(0,2.5,-6)，Camera(-8,1.5,-8)

## 渲染管线修正（7月7日）
- **实际使用**：Unity 内置渲染管线（Built-in RP），非 URP
- 原因：内置管线更适合 Geometry Shader + Tessellation 组合，且对花窗项目光照需求足够
- 内置管线局限性：无 IBL（基于图像的光照）、无 SSR、无实时 GI，但对彩色玻璃效果足够

## Shader 架构（7月7日）
- **Glass.shader**（`RoseWindow/Glass`）：实体彩色玻璃渲染
  - 曲面细分 + 高度位移（Domain Shader）
  - 四张贴图：Albedo(MainTex)、HeightMap、Normal(BumpMap)、RoughnessMap
  - 光照：Blinn-Phong + 球谐环境光 + 菲涅尔，三 Pass（ForwardBase/ForwardAdd/ShadowCaster）
  - 预留 _PlayerPos / _PlayerInfluence 接口
- **Cloud.shader**（`RoseWindow/Cloud`）：粒子云渲染（VS→HS→Tess→DS→GS→PS）
  - Alpha 裁剪保证窗形轮廓（透明区域不生成粒子）
  - GS 内 TBN 反推 + 法线采样 + 散射计算
  - PS 完整光照（同 Glass 的 Blinn-Phong + SH + Fresnel）
  - 粒子永远不凝结（_BaseSpread > 0），支持玩家排斥散射
  - Billboard 面片 + 圆形软边遮罩
- **RoseWindowCloud.cs**：C# 控制器，每帧向 Cloud.shader 推送玩家位置和散射参数

## 粒子云交互模型（7月7日）
- 三力叠加：基础弥散（_BaseSpread）+ 玩家排斥（二次衰减）+ 有机布朗运动
- 弹簧阻尼回弹（_HomeSpring）
- GS 内用 `SV_PrimitiveID` 做伪随机三角形内采样（避免质心网格感）

## 光线系统（6月10日确定）
- **设计哲学**："光是主语，窗是谓语"——光定义窗，而非窗发光
- **第一层**：尘埃光柱（物理正确、丁达尔效应、轻量粒子布朗运动）
- **第二层**：粒子穿越（站在窗下仰视触发、彩色粒子从窗格射向观众）
- **第三层**：超维时空（可选、Interstellar风格、八百年历史切片长廊）
- 详细框架文件：任务框架_光线部分.md

## 玫瑰窗数字展览系统（新项目，7月9日启动）
- **项目类型**：WebGL 浏览器交互式 3D 展览系统（独立于上述 Unity 项目）
- **技术栈**：Three.js 0.185.1 + http-server + ES Modules + importmap
- **项目路径**：`RoseWindow/`
- **设计文档**：`Project/` 文件夹（01 项目设计、02 技术规格、03 任务列表、04 交互行为 + 全局要求.txt）
- **里程碑**：M1~M8（M1 框架 ✅ / M2 场景 ✅ / M3 玩家 ✅ / M4 光点 ✅ / M5 节点 ✅ / M6 面板 ✅ / M7 优化 / M8 可选）
- **M1 完成内容**：项目骨架 + 渲染基础（Renderer/Camera/Scene/ResizeHandler/RenderLoop/Application）
- **M2 完成内容**（7月9日）：白色地板 + GLB玫瑰窗模型加载 + 三层光照(Ambient/Hemisphere/Directional) + HDR环境贴图(PMREM) + ResourceManager统一资源管理；Application改为async启动流程（技术规格§15事件流）；ACESFilmic色调映射+sRGB色彩空间
- **M3 完成内容**（7月9日）：第一人称控制器（PointerLockControls鼠标视角+自实现WASD平滑阻尼移动+Shift冲刺）+ 移动范围限制（圆形外边界25m+玫瑰窗排斥1.2m）+ pointer-lock入场遮罩（glassmorphism）；眼高1.7m
- **M4 完成内容**（7月9日）：交互式光点系统——5万光点从GLB两mesh采样(MeshSurfaceSampler+UV查贴图色)，世界空间；全部位移/动画/恢复在GPU顶点着色器(距离smoothstep强度+高斯空间权重+法线主分量+远离玩家小分量位移+sin呼吸)；AdditiveBlending发光；采样后隐藏实体模型，光点成为作品本身
- **6 大模块架构**：Scene / Player / LightPoint / InfoNode / InfoPanel / ResourceManager
- **关键约束**：相机 FOV60/near0.1/far100；玫瑰窗中心(0,2,0)；玩家初始距10m；集中配置对象；State File 强制要求
- **场景简化**（全局要求覆盖 02 文档）：当前版本仅玫瑰窗 + 白色地板，无天花板/围墙
- **状态文件**：`RoseWindow/STATE.md` 记录进度

## 用户偏好
- 追求"巧妙"而非"套公式"——数学等价性美学、概念反转优先于技术堆砌
- 物理正确是基础（尘埃不是装饰，是光柱可见的前提）
- 偏向艺术效果展示而非教学功能
- 要求技术方案新颖、不烂大街
- 已否决"完整建筑建模"方案（工作量不可行）
- 倾向一人可完成的务实方案
