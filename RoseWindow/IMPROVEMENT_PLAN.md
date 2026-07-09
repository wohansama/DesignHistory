# 进阶改进方案 — 着色器 + 环境音效

## 一、着色器改进（PointShader.js + LightPointSystem.js）

### 1.1 噪声驱动的待机动画（替代纯 sin 波）

**现状**：`idle = sin(time × freq + seed × 2π) × amplitude`，所有点同步节奏，机械感强。

**改进**：用 hash-based 程序化噪声驱动位移，每个点独立运动，不同步。

顶点着色器新增噪声函数：
```glsl
// 简化 3D 噪声 — 基于 hash 的 value noise，无需纹理，GPU 友好
float hash(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);  // smoothstep interpolation
  // 8 角点 trilinear 插值
  float n000 = hash(i);
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}
```

待机位移改为：
```glsl
// 原来纯 sin：
// float idle = sin(uTime * uIdleFrequency * 6.2832 + phase) * uIdleAmplitude;

// 改为 sin + 噪声混合：
float noiseT = noise3(position * 0.5 + uTime * 0.15);  // 空间相关、时间演化
float idle = (sin(uTime * uIdleFrequency * 6.2832 + phase) * 0.5 + noiseT * 0.5) * uIdleAmplitude;
```

效果：呼吸节奏不再全局同步，每个点有自己的"呼吸频率"，像光在空气中真实漂移。

### 1.2 核心+光晕双层点（片元着色器）

**现状**：单高斯 `exp(-dist²×14)`，一个柔斑。

**改进**：窄核心 + 宽光晕双层叠加：
```glsl
// 窄核心 — 亮而集中
float core = exp(-dist * dist * 40.0);
// 宽光晕 — 暗而弥散
float halo = exp(-dist * dist * 6.0);

// 核心+光晕叠加亮度，alpha 取两者最大
float brightness = core * 1.5 + halo * 0.4;
float alpha = max(core, halo * 0.6) * uOpacity * uGlobalOpacity;

vec3 color = vColor * brightness * (0.85 + 0.15 * vAlphaBoost);
gl_FragColor = vec4(color, alpha);
```

效果：每个点是"亮核 + 弥散光晕"，加法混合下重叠核心爆白、光晕互相叠加——比单高斯更像真实光粒。

### 1.3 色彩饱和度微提升（片元着色器）

```glsl
// 轻微饱和度增强 — 拉离灰度
float gray = dot(vColor, vec3(0.299, 0.587, 0.114));
vec3 saturated = mix(vec3(gray), vColor, 1.25);
vec3 color = saturated * brightness * (0.85 + 0.15 * vAlphaBoost);
```

### 1.4 位移噪声调制（顶点着色器）

位移幅度不再是纯 smoothstep，加噪声起伏：
```glsl
float noiseDisp = noise3(position * 0.3 + uTime * 0.08) * 0.15;  // ±15% 起伏
float mag = intensity * spatialW * uMaxDisplacement * (1.0 + noiseDisp);
```

### 改动文件
- `src/lightpoints/PointShader.js` — 加噪声函数 + 改 idle/片元/位移
- 无需改 LightPointSystem.js（无新 uniform）

---

## 二、环境音效 — 教堂圣咏风格（程序化 Web Audio API）

### 2.1 整体音景设计

基调：教堂空间的混响感 + 圣咏般的和声 drone + 空灵的高频微光。

| 层 | 声音 | 频率/参数 | 作用 |
|----|------|-----------|------|
| **低 drone** | 55Hz (A1) 正弦 + 82.4Hz (E2) 三角 | 慢 LFO 0.07Hz 振幅调制 | 教堂管风琴般的基底 |
| **和声层** | 220Hz (A3) + 277Hz (C#4) + 330Hz (E4) 正弦，音量极低 | A大三和弦，慢颤音 | 圣咏感和声，极轻 |
| **高频 shimmer** | 滤波白噪声 → 低通 | 截止频率 800-4000Hz 随距离变化 | 空气感、光的感觉 |
| **混响** | ConvolverNode + 程序生成脉冲 | 衰减 4s，早期反射模拟教堂 | 统一空间感 |

### 2.2 交互响应

| 事件 | 音效 | 实现 |
|------|------|------|
| **靠近窗户** | shimmer 低通截止频率升高（800→4000Hz），drone 音量微增 | 距离映射到滤波器频率 |
| **远离（消散过渡）** | 低通截止频率降低（声音变暗沉空灵），drone 变薄 | 消散因子映射 |
| **节点悬停** | 柔和钟声 ping（440Hz 正弦，0.3s 指数衰减 + 混响） | 短促触发 |
| **节点选中** | 确认双音（523Hz + 659Hz，C5+E5，0.5s 衰减） | 短促触发 |

### 2.3 教堂混响脉冲生成

程序生成衰减白噪声脉冲，模拟教堂大空间：
```js
function createReverbImpulse(audioCtx, duration = 4.0, decay = 2.5) {
  const rate = audioCtx.sampleRate;
  const length = rate * duration;
  const impulse = audioCtx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // 指数衰减白噪声 + 早期反射（前 80ms 增强密度）
      const t = i / length;
      const envelope = Math.pow(1 - t, decay);
      const earlyReflection = i < rate * 0.08 ? 1.5 : 1.0;
      data[i] = (Math.random() * 2 - 1) * envelope * earlyReflection;
    }
  }
  return impulse;
}
```

### 2.4 启动时机

浏览器自动播放策略要求用户手势。当前流程：
- 玩家点击遮罩 → pointer lock → **此时启动音频**
- AudioContext 在 click 回调中 resume，然后开始播放 drone + shimmer

### 2.5 每帧更新

在 Application._update 中，根据玩家距离/消散因子更新音效参数：
```js
if (this._audio) {
  const factor = this._lightPoints.getDissipationFactor();
  this._audio.update(factor, this._lightPoints.getState());
}
```

AudioEngine.update(factor, state):
- shimmer 滤波器截止频率 = lerp(800, 4000, 1 - factor)  // 近处亮、远处暗
- drone 音量 = lerp(0.3, 0.5, 1 - factor)  // 近处更饱满

### 2.6 文件结构

新建 `src/audio/AudioEngine.js`：
```js
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverb = null;
    this.drones = [];      // 振荡器数组
    this.shimmerFilter = null;
    this.shimmerGain = null;
  }
  start() { /* 创建 AudioContext, 振荡器, 噪声, 混响, 启动播放 */ }
  update(dissipationFactor, state) { /* 更新滤波器/音量 */ }
  playHoverPing() { /* 节点悬停钟声 */ }
  playSelectTone() { /* 节点选中确认音 */ }
  dispose() { /* 停止所有振荡器, 关闭 AudioContext */ }
}
```

### 改动文件
- 新建：`src/audio/AudioEngine.js`
- 改：`src/core/Application.js`（创建 AudioEngine，pointer lock 时 start，_update 时 update，节点 onSelect 时 playSelectTone，节点 onHoverChange 时 playHoverPing）
- 改：`src/info-nodes/InfoNodeSystem.js`（hover 时触发音效回调）

---

## 三、实施顺序建议

1. **着色器：噪声呼吸 + 核心/光晕双层**（视觉提升最大）
2. **着色器：饱和度 + 位移噪声**（锦上添花）
3. **音效：drone + shimmer + 混响基底**（氛围骨架）
4. **音效：交互响应**（距离滤波、节点 ping）

---

## 四、参数集中管理

所有新增参数在 Config.js 新增段：
```js
shader: {
  noiseIdleWeight: 0.5,    // 噪声 vs sin 的混合比
  coreSharpness: 40.0,     // 核心高斯锐度
  haloSharpness: 6.0,      // 光晕高斯锐度
  saturation: 1.25,        // 饱和度增强倍率
  displacementNoise: 0.15, // 位移噪声幅度
},
audio: {
  enabled: true,
  droneFreqs: [55, 82.4, 220, 277, 330],  // A1, E2, A3, C#4, E4
  shimmerFreqRange: [800, 4000],
  reverbDuration: 4.0,
  hoverPingFreq: 440,
  selectToneFreqs: [523, 659],
},
```
