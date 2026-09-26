# 语音源与发音设置 设计文档

日期：2026-09-26
状态：待评审

## 1. 背景

字母乐园的「学一学」「认单词」点击卡片后没有英文读音。排查后确认根因在 `utils/tts.ts` 的
语音挑选逻辑：

- 代码用 Web Speech API 并声明 `lang: 'en-US'`
- 但 `getVoices()` 在 Chrome 里同步返回的只有设备本地音色（本机实测仅 3 个 `zh-CN`）
- `cachedVoices` 因此被填成「3 个中文音色」，`pickVoice('en-US')` 永远返回 `undefined`
- `lang` 留空 → 浏览器回退到默认中文语音，用中文音素念英文

家长端目前只有一个「语音」开关（`child-study-tts-enabled`），无法选择发音来源、音色、
语速与音调。本设计把发音能力做成家长可配置的，并让家长能选到真正适合自己设备的语音源。

## 2. 目标与非目标

### 目标

1. 家长端可选择语音源：**系统语音** 或 **微软 Azure**
2. 可选择音色（中文、英文各一个）、语速、音调
3. 选定后**所有朗读**（中文与英文、含整句）都走该源
4. 选定源不可用时**自动切到另一个源**，两者都不可用才静默，并在家长端给出明确提示
5. 宝宝端所有调用点（拼音、卡片、数字、诗歌、引导语、字母乐园）**无需改动**

### 非目标

- 不实现多厂商插件市场；只做两个源（`azure` / `system`），但配置结构预留扩展位
- 不做离线音频打包
- 不改中文内容层的朗读文案

## 3. 已实测的接口约束（换接口前必读）

以下结论均为本轮实测所得，附判别依据，避免后人重走弯路。

| 接口 | 结论 | 判别依据 |
|---|---|---|
| **微软 Edge Read Aloud**<br>`wss://speech.platform.bing.com/.../readaloud/edge/v1` | **不可用（非 Edge 环境）** | 免 key，但**握手的 User-Agent 必须是 Edge**：Edge UA → `101`；纯 Chrome UA → `403`；无 UA → `403`。Origin 与域名一律不校验（带 `http://localhost:5666` Origin 仍 101）。浏览器的 WS 握手 UA 由浏览器固定，JS 无法修改 |
| 微软音色列表端点 | 可用 | Chrome UA 也返回 `200`。说明 UA 校验**只针对合成路径** |
| **Azure AI Speech**<br>`https://{region}.tts.speech.microsoft.com/cognitiveservices/v1` | **可用** | 4 个区域端点全可达；实际 POST 响应带 `access-control-allow-origin: *`，预检放行 `ocp-apim-subscription-key` / `x-microsoft-outputformat` 等头 → **浏览器可直连**。需要订阅 key |
| **有道** `dict.youdao.com/dictvoice` | 仅英文单词 | 英文字母 26/26、单词 26/26 可用；英文整句 17/26 稳定返回 `500`；中文句子 8/8 返回 `500`。**不可用于中文** |
| **百度** `fanyi.baidu.com/gettts` | 数据全能，但防盗链 | 中文 14/14、英文 78/78 全通过；但**带 `Referer` 即返回空 `text/html`**，页面里的 `<audio>` 必然带 Referer |
| `HTMLMediaElement.referrerPolicy` | 不支持 | `'referrerPolicy' in new Audio()` → `false`，无法按元素抑制 Referer |
| Edge `getVoices()` 时序 | **异步就绪** | 页面加载瞬间返回 **0** 个，约 300ms 后变为 325 个（含 47 个英文） |
| Chrome `getVoices()`（本机） | 同步但只有本地音色 | 加载瞬间即返回 3 个 `zh-CN`，且此后不再变化 → 这是原始 bug 的机制 |

> 百度那条路（含用 no-referrer meta 绕过防盗链）已验证可行，但**本设计不采用**：
> 它不支持音色与音调，且绕过防盗链对上线产品是业务风险。

## 4. 架构

```
家长端设置页 (views/parent/settings)
  └─ 语音设置：语音源 / 中文音色 / 英文音色 / 语速 / 音调
        ↓ 读写
  utils/tts-settings.ts   ← 只管配置：默认值、校验、脏数据容错、旧键迁移
        ↓ 消费
  utils/tts.ts  speak(text, { lang })
        ├─ 源 = system → Web Speech API（等待音色就绪；套用 rate / pitch / voice）
        └─ 源 = azure  → POST apps/tts-proxy → mp3 → <audio>（playbackRate 控语速）
                              ↓
                        Cloudflare Worker（持 Azure key，带缓存）
```

关键性质：**改的是管道，不是调用点**。宝宝端十来个 `speak()` 调用点一行都不用动。

## 5. 组件设计

### 5.1 `utils/tts-settings.ts`（新增）

单一职责：配置的读写与校验。不涉及任何播放逻辑。

```ts
export type TtsSource = 'azure' | 'system';

export const SUPPORTED_LANGS = ['zh-CN', 'en-US'] as const;
export type TtsLang = (typeof SUPPORTED_LANGS)[number];

export interface TtsSettings {
  enabled: boolean;
  source: TtsSource;
  /** 各语言选定的音色 id；空串表示用该源的默认音色 */
  voices: Record<TtsLang, string>;
  /** 语速倍率 */
  rate: number;
  /** 音调，百分比（Azure prosody / Web Speech pitch 的量纲） */
  pitch: number;
}
```

- 存储：`localStorage`，单键 `child-study-tts-settings`（JSON）。
  沿用 `child-study-tts-enabled` 的做法而非 pinia store —— `tts.ts` 被 `use-quiz.ts` 等
  引用，走 store 会形成循环依赖（现有代码注释已记录此约束）。
- 默认值：`source: 'azure'`、`voices` 全空串、`rate: 0.9`、`pitch: 0`
- 校验：`rate` 夹到 `[0.5, 1.5]`，`pitch` 夹到 `[-50, 50]`，非法枚举值回落默认
- **脏数据容错**：`JSON.parse` 失败或字段类型不符时返回默认值，不抛错
- **迁移**：读到旧键 `child-study-tts-enabled` 时映射为 `enabled`，写新键后删除旧键

### 5.2 `utils/tts.ts`（改造）

对外签名基本不变，仍是 `speak(text, { lang, onEnd, rate })`。新增内部路由：

1. 读配置 → 未启用则直接 `onEnd()`
2. 按 `source` 选通道
3. **降级**：选定通道判定为「对该语言不可用」时，自动改用另一通道
4. 两个通道都不可用 → 静默 + `onEnd()`，并把不可用状态暴露给设置页展示

**系统语音通道**（现有路径修正）：

- 修正音色就绪：`getVoices()` 为空或缺少目标语言时，等待一次 `voiceschanged` 再重试
  （Edge 加载瞬间返回 0，实测 300ms 后才就绪）
- 目标语言无音色 → 判定不可用 → 触发降级（**不再**回退到中文音色念英文）
- 套用 `settings.rate` → `utterance.rate`，`settings.pitch` → `utterance.pitch`
- 音色取 `settings.voices[lang]`，为空则按语言挑默认

**Azure 通道**：

- `POST {VITE_TTS_PROXY_URL}/tts`，body `{ text, lang, voice, rate, pitch }`
- 响应二进制 → `Blob` → `URL.createObjectURL` → `<audio>` 播放，`playbackRate = settings.rate`
- 必须在播放结束后 `URL.revokeObjectURL`，避免内存泄漏
- 网络失败 / 非 2xx → 触发降级

**中英互斥**：两个通道共用一个「当前正在播放」的句柄，任何一次 `speak()` 先停掉当前的
（含 `speechSynthesis.cancel()` 与 `<audio>` 的 pause + 释放）。现有 `speakEnglish` /
`stopEnglish` 里的幂等 `finish`、`removeAttribute('src')` 两处逻辑要迁进 Azure 通道保留。

> **决策：移除有道通道。** 现有英文走有道的 `speakEnglish` 及其调用点（`use-quiz.ts` 的
> `sayLetter` / `sayWord`、`letters/index.vue`）一并改回 `speak(text, { lang })`。
> 理由：有道只能读英文单词，天然违反「选定一个源、所有朗读都走它」的模型；把它留作兜底
> 等于在字母乐园里保留一条绕过家长设置的旁路，会出现「家长设置了却仍走别的接口」。
> 降级链因此明确为：**选定源 → 另一源 → 静默**。

### 5.3 `apps/tts-proxy`（新增，Cloudflare Worker）

```
GET  /voices
  200 → [{ id, lang, name }]   精选音色列表（单一事实来源）

POST /tts
  body: { text: string, lang: 'zh-CN'|'en-US', voice?: string, rate?: number, pitch?: number }
  200 → audio/mpeg
  400 → { error }  参数非法
  502 → { error }  上游失败
```

- 环境变量（`wrangler secret`）：`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`
- 构造 SSML：`<voice name="{voice}"><prosody rate="{rate}" pitch="{pitch}">{text}</prosody></voice>`，
  其中 `rate` 传相对值字符串（如 `0.9` → `"-10%"`），`pitch` 传 `"{n}%"`，量纲与 Azure SSML 一致
- 走 `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`
- **参数校验**：`text` 长度上限（建议 300 字符）、`lang` 白名单、`voice` 必须命中
  `GET /voices` 的同一份常量，防止被当作免费 TTS 代理刷爆额度
- **音色列表由 worker 提供**（`GET /voices`），前端拉取后渲染下拉。这样白名单只有一份，
  不会出现前后端列表漂移
- **缓存**：用 Cloudflare Cache API，key 为 `(text, lang, voice, rate, pitch)` 的哈希。
  引导语、表扬语、鼓励语高度重复，命中率会很高——这直接决定 Azure 额度消耗
- **CORS**：只放行前端来源，不用 `*`
- **key 不进日志、不进响应**

### 5.4 家长端设置 UI（改造 `views/parent/settings/index.vue`）

现有「语音」开关下方扩成一组，沿用 `parent.settings.*` i18n 结构：

```
语音                  [开/关]
语音源                [系统语音 / 微软 Azure]
中文音色              [下拉，按源加载]
英文音色              [下拉，按源加载]
语速                  [滑块 0.5–1.5]
音调                  [滑块 -50–+50]
```

- **音色列表来源**：系统语音 → `speechSynthesis.getVoices()` 按语言过滤；
  Azure → 拉取 worker 的 `GET /voices`（单一事实来源，见 5.3）。
  两个源都拿不到列表时，下拉置灰并提示
- **不可用提示**：当前源在某种语言下无可用音色时，该项下方显示红字，
  文案说明「将自动改用另一语音源」；两个源都不可用时升级为醒目警告

## 6. 数据流

```
家长改设置 → tts-settings 写入 localStorage → 设置页即时重渲染
宝宝点击 → speak(text, {lang})
  → 读配置 → 判定通道可用性 → 选通道（可能降级）
  → 系统语音: 等音色就绪 → SpeechSynthesisUtterance(voice/rate/pitch) → speak()
  → Azure: POST worker → 命中缓存直接回 mp3 / 未命中回源 Azure → Blob → <audio> → 播放
  → 播放结束/失败 → 释放资源 → onEnd()
```

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| 未配置 Azure（worker 地址为空或 502） | 降级到系统语音 |
| 系统语音缺目标语言音色 | 降级到 Azure |
| 两个源都不可用 | 静默，不抛错；设置页显示警告 |
| 网络超时 | 降级；worker 侧设上游超时 |
| 用户连点 | 停掉上一条再播新的（中英互斥） |
| `localStorage` 数据损坏 | 回落默认值，不抛错 |

## 8. 测试计划

- `tts-settings` 单测：默认值、`rate`/`pitch` 夹取、非法枚举回落、JSON 损坏容错、旧键迁移
- `tts` 路由单测：选源正确、降级两条路径、中英互斥、资源释放（`revokeObjectURL`）
- worker 单测：参数校验（超长文本 / 非法 lang / 非白名单音色）、SSML 构造、缓存命中、
  key 不出现在日志与响应
- 系统语音通道：用假 `speechSynthesis` 断言「音色缺失时不会用中文音色念英文」
- **真机验证（必须）**：iPad / 安卓平板上的 `getVoices()` 中英文音色覆盖。
  这一步不通过，系统语音源在移动端的可用性假设就是悬空的

## 9. 部署与配置

- worker：`wrangler deploy`；`wrangler secret put AZURE_SPEECH_KEY`
- 前端：`.env` 增加 `VITE_TTS_PROXY_URL`，并在 `.env.example` 记录
- Azure：F0 免费层（每月 50 万字符，不超额计费）。**若升级到 S0 付费层需重新评估安全边界**
- key 只存在 worker 的 secret 中，**不提交进仓库**

## 10. 风险

1. **Azure 额度**：免费层 50 万字符/月；靠 worker 缓存与文本长度上限控制。需在实现后
   实测一次引导语/表扬语的缓存命中率
2. **移动端音色假设未验证**：见第 8 节真机验证项
3. **worker 成为单点**：worker 不可用时自动降级到系统语音，不会完全失声
4. **迁移**：家长的旧「语音开关」设置需要平滑迁移，见 5.1
5. **过渡期英文会静默**：移除有道后，英文朗读需要「设备装了英文系统音色」或「worker 已部署」
   二选一。两样都没有时英文无声（中文不受影响）。这是决策 5.2 的直接后果，
   不是缺陷；缓解方式是先跑通 worker，或临时安装系统英文语音包
