# 语音源与发音设置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让家长可选择语音源（微软 Azure / 系统语音）、音色、语速、音调，选定后所有朗读都走该源，源不可用时自动降级到另一个源。

**Architecture:** 配置存 localStorage（不引 pinia，避免 `tts.ts` ↔ store 循环依赖），由 `utils/tts-settings.ts` 独占管理。`utils/tts.ts` 的 `speak()` 变成路由器，按配置分流到「系统语音通道（Web Speech）」或「Azure 通道（Cloudflare Worker 代理 + `<audio>`）」。宝宝端十来个调用点一行不改。

**Tech Stack:** Vue 3 + TypeScript + Vitest(happy-dom) + ant-design-vue；Cloudflare Workers（Wrangler）+ Azure AI Speech REST。

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-09-26-tts-provider-settings-design.md`（实现前必读第 3 节「已实测的接口约束」）
- 测试命令：`pnpm vitest run --dom <path>`（根目录执行，happy-dom 环境）
- 类型检查：`pnpm -F @vben/web-antd run typecheck`
- Lint：`npx eslint <files>`（`perfectionist` 规则强制 import 与类成员的排序）
- happy-dom **不提供** `localStorage` 与 `speechSynthesis`，测试里必须 stub
- 提交格式沿用仓库现状：`feat(kid): ...` / `fix(kid): ...` / `test(...)` / `chore(...)`
- **Azure key 只存在 Worker 的 secret 中，任何情况下不写进仓库、不进前端、不进日志**
- 中文与英文互斥：同一时刻只能有一段声音
- 测试里用 `vi.stubEnv('VITE_TTS_PROXY_URL', ...)` 控制代理地址。若发现该值没生效
  （`import.meta.env` 在某些 vitest 配置下不被 `stubEnv` 覆盖），**不要改测试去迁就**，
  而是在 `tts-azure.ts` 里加一层间接：`function proxyBase() { return import.meta.env.VITE_TTS_PROXY_URL ?? ''; }`
  并让测试 spy 该函数——保持「测试驱动实现」的方向

---

### Task 1: 语音配置模块

**Files:**
- Create: `apps/web-antd/src/utils/tts-settings.ts`
- Test: `apps/web-antd/src/utils/__tests__/tts-settings.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type TtsSource = 'azure' | 'system'`
  - `type TtsLang = 'zh-CN' | 'en-US'`
  - `const SUPPORTED_LANGS: TtsLang[]`
  - `interface TtsSettings { enabled: boolean; pitch: number; rate: number; source: TtsSource; voices: Record<TtsLang, string> }`
  - `const DEFAULT_SETTINGS: TtsSettings`
  - `function getTtsSettings(): TtsSettings`
  - `function saveTtsSettings(settings: TtsSettings): boolean` —— 写入成功返回 `true`，失败返回 `false` 且不抛错。
    读路径可以吞掉异常回落默认值，**写路径不能**：静默失败会让家长改了设置、界面显示新值、
    存储里还是旧值，刷新即回退且无从查起。调用方（设置页）负责把 `false` 变成用户可见的提示。
  - 存储键 `child-study-tts-settings`；旧键 `child-study-tts-enabled` 首次读取时迁移并删除

> **不要**在本模块 import `tts.ts`（`setTtsEnabled` 需要 `stopSpeak`，反向依赖会造成循环）。

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/utils/__tests__/tts-settings.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
} from '#/utils/tts-settings';

const SETTINGS_KEY = 'child-study-tts-settings';
const LEGACY_KEY = 'child-study-tts-enabled';

/** happy-dom 不提供 localStorage，用内存版顶替 */
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  });
}

describe('tts-settings', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('没有存储时返回默认值', () => {
    expect(getTtsSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('默认走 azure，中文与英文音色均为空串（表示用该源默认音色）', () => {
    const settings = getTtsSettings();
    expect(settings.source).toBe('azure');
    expect(settings.voices['zh-CN']).toBe('');
    expect(settings.voices['en-US']).toBe('');
  });

  it('可保存并读回', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, pitch: 20, rate: 1.2, source: 'system' });
    const settings = getTtsSettings();
    expect(settings.source).toBe('system');
    expect(settings.rate).toBe(1.2);
    expect(settings.pitch).toBe(20);
  });

  it('语速被夹到 [0.5, 1.5]', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 9 });
    expect(getTtsSettings().rate).toBe(1.5);
    saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 0 });
    expect(getTtsSettings().rate).toBe(0.5);
  });

  it('音调被夹到 [-50, 50]', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, pitch: 999 });
    expect(getTtsSettings().pitch).toBe(50);
    saveTtsSettings({ ...DEFAULT_SETTINGS, pitch: -999 });
    expect(getTtsSettings().pitch).toBe(-50);
  });

  it('非法的 source 回落为 azure', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ source: 'google' }));
    expect(getTtsSettings().source).toBe('azure');
  });

  it('损坏的 JSON 不会抛错，回落默认值', () => {
    localStorage.setItem(SETTINGS_KEY, '{ 这不是合法 JSON');
    expect(() => getTtsSettings()).not.toThrow();
    expect(getTtsSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('voices 里的非字符串值被规范成空串', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ voices: { 'en-US': 42, 'zh-CN': 'zh-CN-XiaoxiaoNeural' } }),
    );
    const settings = getTtsSettings();
    expect(settings.voices['en-US']).toBe('');
    expect(settings.voices['zh-CN']).toBe('zh-CN-XiaoxiaoNeural');
  });

  it('首次读取时迁移旧开关并删除旧键', () => {
    localStorage.setItem(LEGACY_KEY, '0');
    const settings = getTtsSettings();
    expect(settings.enabled).toBe(false);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it('已有的新配置不会被旧开关覆盖', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, enabled: true, rate: 1.3 });
    localStorage.setItem(LEGACY_KEY, '0');
    const settings = getTtsSettings();
    expect(settings.rate).toBe(1.3);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run --dom apps/web-antd/src/utils/__tests__/tts-settings.test.ts`
Expected: FAIL —— `Failed to resolve import "#/utils/tts-settings"`

- [ ] **Step 3: 实现**

创建 `apps/web-antd/src/utils/tts-settings.ts`：

```ts
/**
 * 语音设置：家长可配置发音来源、音色、语速与音调。
 *
 * 只负责「配置的读写与校验」，不碰任何播放逻辑（播放见 utils/tts.ts）。
 * 用 localStorage 而非 pinia store：tts.ts 被 use-quiz.ts 等引用，
 * 走 store 会形成循环依赖。
 */

export type TtsSource = 'azure' | 'system';
export type TtsLang = 'en-US' | 'zh-CN';

export const SUPPORTED_LANGS: TtsLang[] = ['zh-CN', 'en-US'];

export interface TtsSettings {
  enabled: boolean;
  /** 音调，百分比，与 Azure SSML / Web Speech pitch 量纲一致 */
  pitch: number;
  /** 语速倍率 */
  rate: number;
  source: TtsSource;
  /** 各语言选定的音色 id；空串表示用该源的默认音色 */
  voices: Record<TtsLang, string>;
}

export const DEFAULT_SETTINGS: TtsSettings = {
  enabled: true,
  pitch: 0,
  rate: 0.9,
  source: 'azure',
  voices: { 'en-US': '', 'zh-CN': '' },
};

const SETTINGS_KEY = 'child-study-tts-settings';
/** 旧版本只有这一个开关，首次读取时迁移 */
const LEGACY_ENABLED_KEY = 'child-study-tts-enabled';

const MIN_RATE = 0.5;
const MAX_RATE = 1.5;
const MIN_PITCH = -50;
const MAX_PITCH = 50;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** 把任意来源的数据规范化成合法配置，非法项一律回落默认值 */
function normalize(raw: unknown): TtsSettings {
  const input = (raw ?? {}) as Partial<TtsSettings>;
  const voices = { ...DEFAULT_SETTINGS.voices };
  for (const lang of SUPPORTED_LANGS) {
    const value = input.voices?.[lang];
    voices[lang] = typeof value === 'string' ? value : '';
  }
  return {
    enabled:
      typeof input.enabled === 'boolean'
        ? input.enabled
        : DEFAULT_SETTINGS.enabled,
    pitch: clamp(input.pitch, MIN_PITCH, MAX_PITCH, DEFAULT_SETTINGS.pitch),
    rate: clamp(input.rate, MIN_RATE, MAX_RATE, DEFAULT_SETTINGS.rate),
    source: input.source === 'system' ? 'system' : 'azure',
    voices,
  };
}

function readStorage(key: string): null | string {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式等场景下写入失败，忽略即可
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getTtsSettings(): TtsSettings {
  const raw = readStorage(SETTINGS_KEY);
  if (raw === null) return migrateLegacy();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return normalize(undefined);
  }
}

export function saveTtsSettings(settings: TtsSettings): void {
  writeStorage(SETTINGS_KEY, JSON.stringify(normalize(settings)));
}

/** 旧版本只有 child-study-tts-enabled 一个开关，首次读取时迁移过来并删除旧键 */
function migrateLegacy(): TtsSettings {
  const legacy = readStorage(LEGACY_ENABLED_KEY);
  if (legacy === null) return normalize(undefined);
  const settings = normalize({ enabled: legacy !== '0' });
  saveTtsSettings(settings);
  removeStorage(LEGACY_ENABLED_KEY);
  return settings;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run --dom apps/web-antd/src/utils/__tests__/tts-settings.test.ts`
Expected: PASS，10 passed

- [ ] **Step 5: Lint 与提交**

```bash
npx eslint --fix apps/web-antd/src/utils/tts-settings.ts apps/web-antd/src/utils/__tests__/tts-settings.test.ts
git add apps/web-antd/src/utils/tts-settings.ts apps/web-antd/src/utils/__tests__/tts-settings.test.ts
git commit -m "feat(kid): 新增语音设置模块（语音源/音色/语速/音调）"
```

---

### Task 2: Cloudflare Worker —— 语音代理

**Files:**
- Create: `apps/tts-proxy/package.json`
- Create: `apps/tts-proxy/wrangler.toml`
- Create: `apps/tts-proxy/src/voices.ts`
- Create: `apps/tts-proxy/src/ssml.ts`
- Create: `apps/tts-proxy/src/validate.ts`
- Create: `apps/tts-proxy/src/index.ts`
- Test: `apps/tts-proxy/src/__tests__/ssml.test.ts`
- Test: `apps/tts-proxy/src/__tests__/validate.test.ts`
- Test: `apps/tts-proxy/src/__tests__/handler.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `const VOICES: { id: string; lang: 'en-US' | 'zh-CN'; name: string }[]`
  - `function findVoice(id: string): { id: string; lang: TtsLang; name: string } | undefined`
  - `function buildSsml(p: SynthRequest): string`
  - `function rateToProsody(rate: number): string` / `function pitchToProsody(pitch: number): string`
  - `interface SynthRequest { text: string; lang: TtsLang; voice: string; rate: number; pitch: number }`
  - `function parseSynthRequest(raw: unknown): { ok: true; value: SynthRequest } | { ok: false; error: string }`
  - `function handleRequest(request: Request, env: Env, deps?: Deps): Promise<Response>`
  - `interface Env { ALLOWED_ORIGIN: string; AZURE_SPEECH_KEY: string; AZURE_SPEECH_REGION: string }`
  - `interface Deps { cache?: CacheLike | null; fetchImpl?: typeof fetch }`

> 路由：`GET /voices` 返回音色列表；`POST /tts` 合成。两者都要 CORS 头。

- [ ] **Step 1: 建 package.json 与 wrangler.toml**

`apps/tts-proxy/package.json`：

```json
{
  "name": "@vben/tts-proxy",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

`apps/tts-proxy/wrangler.toml`：

```toml
name = "child-study-tts"
main = "src/index.ts"
compatibility_date = "2026-09-01"

[vars]
ALLOWED_ORIGIN = "https://your-app-domain.example"

# secret 用命令写入，不要写在这里：
#   wrangler secret put AZURE_SPEECH_KEY
#   wrangler secret put AZURE_SPEECH_REGION
```

- [ ] **Step 2: 写音色表与 SSML 的失败测试**

`apps/tts-proxy/src/__tests__/ssml.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { buildSsml, pitchToProsody, rateToProsody } from '../ssml';

describe('rateToProsody', () => {
  it('把倍率转成 Azure 的相对百分比', () => {
    expect(rateToProsody(0.9)).toBe('-10%');
    expect(rateToProsody(1)).toBe('+0%');
    expect(rateToProsody(1.25)).toBe('+25%');
  });
});

describe('pitchToProsody', () => {
  it('保留正负号', () => {
    expect(pitchToProsody(0)).toBe('+0%');
    expect(pitchToProsody(-20)).toBe('-20%');
    expect(pitchToProsody(15)).toBe('+15%');
  });
});

describe('buildSsml', () => {
  it('带音色、语速、音调与语言', () => {
    const ssml = buildSsml({
      lang: 'en-US',
      pitch: 10,
      rate: 0.9,
      text: 'apple',
      voice: 'en-US-AvaNeural',
    });
    expect(ssml).toContain('xml:lang="en-US"');
    expect(ssml).toContain('<voice name="en-US-AvaNeural">');
    expect(ssml).toContain('rate="-10%"');
    expect(ssml).toContain('pitch="+10%"');
    expect(ssml).toContain('>apple<');
  });

  it('转义 XML 特殊字符，中文标点原样保留', () => {
    const ssml = buildSsml({
      lang: 'zh-CN',
      pitch: 0,
      rate: 1,
      text: '猫 & 狗 <玩> "球" ！',
      voice: 'zh-CN-XiaoxiaoNeural',
    });
    expect(ssml).toContain('&amp;');
    expect(ssml).toContain('&lt;');
    expect(ssml).toContain('&gt;');
    expect(ssml).toContain('&quot;');
    expect(ssml).toContain('！');
    expect(ssml).not.toContain('<玩>');
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm vitest run --dom apps/tts-proxy/src/__tests__/ssml.test.ts`
Expected: FAIL —— 无法解析 `../ssml`

- [ ] **Step 4: 实现 voices.ts 与 ssml.ts**

`apps/tts-proxy/src/voices.ts`：

```ts
/**
 * 精选音色白名单。
 *
 * 单一事实来源：前端下拉从 GET /voices 拉取，POST /tts 也用它做校验，
 * 避免前后端各存一份常量后漂移。
 */

export type TtsLang = 'en-US' | 'zh-CN';

export interface AzureVoice {
  id: string;
  lang: TtsLang;
  name: string;
}

export const VOICES: AzureVoice[] = [
  { id: 'zh-CN-XiaoxiaoNeural', lang: 'zh-CN', name: '晓晓 Xiaoxiao（女）' },
  { id: 'zh-CN-XiaoyiNeural', lang: 'zh-CN', name: '晓伊 Xiaoyi（女）' },
  { id: 'zh-CN-YunxiNeural', lang: 'zh-CN', name: '云希 Yunxi（男）' },
  { id: 'zh-CN-YunjianNeural', lang: 'zh-CN', name: '云健 Yunjian（男）' },
  { id: 'zh-CN-YunyangNeural', lang: 'zh-CN', name: '云扬 Yunyang（男）' },
  { id: 'en-US-AvaNeural', lang: 'en-US', name: 'Ava（女）' },
  { id: 'en-US-EmmaNeural', lang: 'en-US', name: 'Emma（女）' },
  { id: 'en-US-AriaNeural', lang: 'en-US', name: 'Aria（女）' },
  { id: 'en-US-AndrewNeural', lang: 'en-US', name: 'Andrew（男）' },
  { id: 'en-US-BrianNeural', lang: 'en-US', name: 'Brian（男）' },
  { id: 'en-US-GuyNeural', lang: 'en-US', name: 'Guy（男）' },
];

export function findVoice(id: string): AzureVoice | undefined {
  return VOICES.find((voice) => voice.id === id);
}
```

`apps/tts-proxy/src/ssml.ts`：

```ts
import type { TtsLang } from './voices';

export interface SynthRequest {
  lang: TtsLang;
  pitch: number;
  rate: number;
  text: string;
  voice: string;
}

/** 倍率 → Azure 相对百分比，如 0.9 → "-10%" */
export function rateToProsody(rate: number): string {
  return formatPercent(Math.round((rate - 1) * 100));
}

export function pitchToProsody(pitch: number): string {
  return formatPercent(Math.round(pitch));
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

/** 文本里的 & < > " ' 必须转义，否则 SSML 解析失败 */
function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSsml(request: SynthRequest): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${request.lang}">` +
    `<voice name="${request.voice}">` +
    `<prosody rate="${rateToProsody(request.rate)}" pitch="${pitchToProsody(request.pitch)}">` +
    `${escapeXml(request.text)}` +
    `</prosody></voice></speak>`
  );
}
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm vitest run --dom apps/tts-proxy/src/__tests__/ssml.test.ts`
Expected: PASS，4 passed

- [ ] **Step 6: 写参数校验的失败测试**

`apps/tts-proxy/src/__tests__/validate.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { MAX_TEXT_LENGTH, parseSynthRequest } from '../validate';

describe('parseSynthRequest', () => {
  it('接受合法请求并回落可选字段的默认值', () => {
    const result = parseSynthRequest({
      lang: 'zh-CN',
      text: '点一点字母',
      voice: 'zh-CN-XiaoxiaoNeural',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rate).toBe(0.9);
    expect(result.value.pitch).toBe(0);
  });

  it('缺 text 时报错', () => {
    expect(parseSynthRequest({ lang: 'zh-CN' }).ok).toBe(false);
  });

  it('空文本报错', () => {
    expect(parseSynthRequest({ lang: 'zh-CN', text: '   ' }).ok).toBe(false);
  });

  it('超长文本报错（防止被当作免费 TTS 代理刷额度）', () => {
    const long = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    expect(parseSynthRequest({ lang: 'en-US', text: long }).ok).toBe(false);
  });

  it('非法 lang 报错', () => {
    expect(parseSynthRequest({ lang: 'ja-JP', text: 'hi' }).ok).toBe(false);
  });

  it('音色不在白名单时报错', () => {
    const result = parseSynthRequest({
      lang: 'en-US',
      text: 'hi',
      voice: 'en-US-NotARealVoice',
    });
    expect(result.ok).toBe(false);
  });

  it('音色与语言不匹配时报错', () => {
    const result = parseSynthRequest({
      lang: 'zh-CN',
      text: '你好',
      voice: 'en-US-AvaNeural',
    });
    expect(result.ok).toBe(false);
  });

  it('语速与音调超出范围时被夹取而非报错', () => {
    const result = parseSynthRequest({
      lang: 'en-US',
      pitch: 999,
      rate: 9,
      text: 'hi',
      voice: 'en-US-AvaNeural',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rate).toBe(1.5);
    expect(result.value.pitch).toBe(50);
  });
});
```

- [ ] **Step 7: 运行确认失败**

Run: `pnpm vitest run --dom apps/tts-proxy/src/__tests__/validate.test.ts`
Expected: FAIL —— 无法解析 `../validate`

- [ ] **Step 8: 实现 validate.ts**

`apps/tts-proxy/src/validate.ts`：

```ts
import type { SynthRequest } from './ssml';
import { findVoice, type TtsLang } from './voices';

/** 单次合成的文本上限，防止 worker 被当作免费 TTS 代理刷爆 Azure 额度 */
export const MAX_TEXT_LENGTH = 300;
const SUPPORTED_LANGS: TtsLang[] = ['zh-CN', 'en-US'];
const DEFAULT_RATE = 0.9;
const DEFAULT_PITCH = 0;

export type ParseResult =
  | { ok: true; value: SynthRequest }
  | { ok: false; error: string };

function clamp(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export function parseSynthRequest(raw: unknown): ParseResult {
  const input = (raw ?? {}) as Record<string, unknown>;

  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) return { error: 'text 不能为空', ok: false };
  if (text.length > MAX_TEXT_LENGTH) {
    return { error: `text 超过 ${MAX_TEXT_LENGTH} 字符上限`, ok: false };
  }

  const lang = input.lang as TtsLang;
  if (!SUPPORTED_LANGS.includes(lang)) {
    return { error: 'lang 不受支持', ok: false };
  }

  // 音色可以省略（空串），此时由调用方按语言补默认音色
  const voiceId = typeof input.voice === 'string' ? input.voice.trim() : '';
  if (voiceId) {
    const voice = findVoice(voiceId);
    if (!voice) return { error: 'voice 不在白名单内', ok: false };
    if (voice.lang !== lang) return { error: 'voice 与 lang 不匹配', ok: false };
  }

  return {
    ok: true,
    value: {
      lang,
      pitch: clamp(input.pitch, -50, 50, DEFAULT_PITCH),
      rate: clamp(input.rate, 0.5, 1.5, DEFAULT_RATE),
      text,
      voice: voiceId,
    },
  };
}
```

> `parseSynthRequest` 只做校验，**不补默认音色**。空串的补默认逻辑在 `index.ts` 的
> `defaultVoiceId(lang)` 里，取 `VOICES` 中该语言的第一项。

- [ ] **Step 9: 运行确认通过**

Run: `pnpm vitest run --dom apps/tts-proxy/src/__tests__/validate.test.ts`
Expected: PASS，8 passed

- [ ] **Step 10: 写 handler 的失败测试**

`apps/tts-proxy/src/__tests__/handler.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';

import { handleRequest, type Env } from '../index';

const ENV: Env = {
  ALLOWED_ORIGIN: 'http://localhost:5666',
  AZURE_SPEECH_KEY: 'test-key',
  AZURE_SPEECH_REGION: 'eastasia',
};

const CORS = { 'CF-Origin': 'http://localhost:5666' };

function postJson(body: unknown, origin = 'http://localhost:5666') {
  return new Request('https://tts.example/tts', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Origin: origin },
    method: 'POST',
  });
}

/** 不落盘的假缓存 */
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    async match(key: Request | string) {
      return store.get(String(key))?.clone();
    },
    async put(key: Request | string, response: Response) {
      store.set(String(key), response.clone());
    },
    size: () => store.size,
  };
}

describe('handleRequest', () => {
  it('GET /voices 返回音色列表与 CORS 头', async () => {
    const response = await handleRequest(
      new Request('https://tts.example/voices', { headers: CORS }),
      ENV,
      { cache: null },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5666',
    );
    const voices = await response.json();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);
  });

  it('参数非法时返回 400 且不调用上游', async () => {
    const fetchImpl = vi.fn();
    const response = await handleRequest(
      postJson({ lang: 'zh-CN' }),
      ENV,
      { cache: null, fetchImpl },
    );
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('合成成功时透传音频，并把 key 放进请求头', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    const response = await handleRequest(
      postJson({ lang: 'en-US', text: 'apple', voice: 'en-US-AvaNeural' }),
      ENV,
      { cache: null, fetchImpl },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('test-key');
    expect(init.headers['Content-Type']).toBe('application/ssml+xml');
    expect(String(init.body)).toContain('<voice name="en-US-AvaNeural">');
  });

  it('缓存命中时不再调用上游', async () => {
    const cache = fakeCache();
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    const request = () =>
      postJson({ lang: 'en-US', text: 'apple', voice: 'en-US-AvaNeural' });

    await handleRequest(request(), ENV, { cache, fetchImpl });
    await handleRequest(request(), ENV, { cache, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('上游失败时返回 502，且响应体里不含 key', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const response = await handleRequest(
      postJson({ lang: 'zh-CN', text: '你好', voice: 'zh-CN-XiaoxiaoNeural' }),
      ENV,
      { cache: null, fetchImpl },
    );
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).not.toContain('test-key');
  });

  it('未指定音色时按语言补默认音色', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    await handleRequest(
      postJson({ lang: 'zh-CN', text: '你好' }),
      ENV,
      { cache: null, fetchImpl },
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(String(init.body)).toContain('zh-CN-XiaoxiaoNeural');
  });
});
```

- [ ] **Step 11: 运行确认失败**

Run: `pnpm vitest run --dom apps/tts-proxy/src/__tests__/handler.test.ts`
Expected: FAIL —— 无法解析 `../index`

- [ ] **Step 12: 实现 index.ts**

`apps/tts-proxy/src/index.ts`：

```ts
/**
 * 语音代理 Worker。
 *
 * 存在的唯一理由：Azure 的订阅 key 不能放前端。前端 -> 本 worker -> Azure。
 * 顺带做缓存：引导语/表扬语高度重复，缓存命中能显著降低 Azure 额度消耗。
 */

import { buildSsml, type SynthRequest } from './ssml';
import { parseSynthRequest } from './validate';
import { VOICES, type TtsLang } from './voices';

export interface Env {
  ALLOWED_ORIGIN: string;
  AZURE_SPEECH_KEY: string;
  AZURE_SPEECH_REGION: string;
}

export interface CacheLike {
  match(key: Request | string): Promise<Response | undefined>;
  put(key: Request | string, response: Response): Promise<void>;
}

export interface Deps {
  cache?: CacheLike | null;
  fetchImpl?: typeof fetch;
}

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const AZURE_TIMEOUT_MS = 15_000;
/** Azure 神经语音的上限，这里给单次请求留足余量即可 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
  };
}

function jsonResponse(data: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
    status,
  });
}

/** 未指定音色时取该语言的第一个 */
export function defaultVoiceId(lang: TtsLang): string {
  return VOICES.find((voice) => voice.lang === lang)?.id ?? '';
}

async function buildCacheKey(voice: string, request: SynthRequest): Promise<string> {
  const payload = [
    request.text,
    request.lang,
    voice,
    String(request.rate),
    String(request.pitch),
  ].join('|');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload),
  );
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `https://tts-cache.invalid/${hash}`;
}

async function synthesize(
  voice: string,
  request: SynthRequest,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const url = `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetchImpl(url, {
    body: buildSsml({ ...request, voice }),
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
    },
    method: 'POST',
    signal: AbortSignal.timeout(AZURE_TIMEOUT_MS),
  });
  return response;
}

export async function handleRequest(
  request: Request,
  env: Env,
  deps: Deps = {},
): Promise<Response> {
  const { cache = null, fetchImpl = fetch } = deps;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(env), status: 204 });
  }

  if (request.method === 'GET' && url.pathname === '/voices') {
    return jsonResponse(VOICES, 200, env);
  }

  if (request.method !== 'POST' || url.pathname !== '/tts') {
    return jsonResponse({ error: 'Not Found' }, 404, env);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: '请求体不是合法 JSON' }, 400, env);
  }

  const parsed = parseSynthRequest(raw);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400, env);

  const voice = parsed.value.voice || defaultVoiceId(parsed.value.lang);
  const cacheKey = await buildCacheKey(voice, parsed.value);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  let upstream: Response;
  try {
    upstream = await synthesize(voice, parsed.value, env, fetchImpl);
  } catch {
    return jsonResponse({ error: '语音服务暂时不可用' }, 502, env);
  }

  if (!upstream.ok) {
    // 不要透传上游响应体，避免任何形式的凭据泄露
    return jsonResponse({ error: '语音服务暂时不可用' }, 502, env);
  }

  const audio = new Response(upstream.body, {
    headers: {
      ...corsHeaders(env),
      'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`,
      'Content-Type': 'audio/mpeg',
    },
    status: 200,
  });

  if (cache) {
    try {
      await cache.put(cacheKey, audio.clone());
    } catch {
      // 缓存写入失败不影响本次返回
    }
  }

  return audio;
}

export default {
  fetch(request: Request, env: Env) {
    // 测试环境没有 Cloudflare 的 caches，此时退化为不走缓存
    const cache =
      typeof caches === 'undefined'
        ? null
        : (caches as unknown as { default: CacheLike }).default;
    return handleRequest(request, env, { cache });
  },
};
```

- [ ] **Step 13: 运行确认通过**

Run: `pnpm vitest run --dom apps/tts-proxy/src/__tests__/handler.test.ts`
Expected: PASS，6 passed

- [ ] **Step 14: Lint 并提交**

```bash
npx eslint --fix apps/tts-proxy/src
git add apps/tts-proxy
git commit -m "feat(tts-proxy): 新增 Azure 语音代理 Worker（含缓存与参数校验）"
```

---

### Task 3: 前端 Azure 通道

**Files:**
- Create: `apps/web-antd/src/utils/tts-azure.ts`
- Test: `apps/web-antd/src/utils/__tests__/tts-azure.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `TtsSettings`；Task 2 的 `GET /voices` / `POST /tts` 契约
- Produces:
  - `function isAzureConfigured(): boolean`
  - `function fetchAzureVoices(): Promise<{ id: string; lang: string; name: string }[]>`
  - `function speakAzure(text: string, options: { lang: TtsLang; voice: string; rate: number; pitch: number; onEnd?: () => void }): void`
  - `function stopAzure(): void`

- [ ] **Step 1: 写失败测试**

`apps/web-antd/src/utils/__tests__/tts-azure.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAzureVoices, isAzureConfigured, speakAzure, stopAzure } from '#/utils/tts-azure';

class FakeAudio {
  static instances: FakeAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = true;
  playbackRate = 1;
  src: string;
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  load() {}
  pause() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
}

const URL_BASE = 'https://tts.example';

describe('tts-azure', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubEnv('VITE_TTS_PROXY_URL', URL_BASE);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('配置了代理地址时视为已配置', () => {
    expect(isAzureConfigured()).toBe(true);
  });

  it('未配置代理地址时视为不可用', () => {
    vi.stubEnv('VITE_TTS_PROXY_URL', '');
    expect(isAzureConfigured()).toBe(false);
  });

  it('合成成功后用 fetch 返回的音频创建并播放', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));

    speakAzure('apple', {
      lang: 'en-US',
      pitch: 0,
      rate: 0.9,
      voice: 'en-US-AvaNeural',
    });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    const audio = FakeAudio.instances[0]!;
    expect(audio.src).toBe('blob:fake');
    expect(audio.playbackRate).toBeCloseTo(0.9);
    expect(audio.paused).toBe(false);

    const [calledUrl, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(calledUrl).toBe(`${URL_BASE}/tts`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).voice).toBe('en-US-AvaNeural');
  });

  it('请求失败时回调 onEnd，不抛错（交给上层降级）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 502 })));
    const onEnd = vi.fn();

    expect(() =>
      speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 0.9, voice: '', onEnd }),
    ).not.toThrow();
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it('网络异常时回调 onEnd', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const onEnd = vi.fn();

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 0.9, voice: '', onEnd });
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it('播放结束后释放 blob URL 并回调 onEnd（只调一次）', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));
    const onEnd = vi.fn();

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 0.9, voice: '', onEnd });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    const audio = FakeAudio.instances[0]!;
    audio.onended?.();
    audio.onended?.();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('播新的之前先停掉上一段', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const first = FakeAudio.instances[0]!;

    speakAzure('bear', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });

    expect(first.paused).toBe(true);
    expect(first.src).toBe('');
  });

  it('stopAzure 会停掉当前音频并释放 URL', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    stopAzure();

    expect(FakeAudio.instances[0]!.paused).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('音色列表请求失败时抛出，交由设置页降级展示', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 500 })));
    await expect(fetchAzureVoices()).rejects.toThrow();
  });

  it('音色列表从 /voices 拉取', async () => {
    const voices = [{ id: 'en-US-AvaNeural', lang: 'en-US', name: 'Ava' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(voices), { status: 200 })),
    );
    await expect(fetchAzureVoices()).resolves.toEqual(voices);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      `${URL_BASE}/voices`,
    );
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run --dom apps/web-antd/src/utils/__tests__/tts-azure.test.ts`
Expected: FAIL —— 无法解析 `#/utils/tts-azure`

- [ ] **Step 3: 实现**

创建 `apps/web-antd/src/utils/tts-azure.ts`：

```ts
/**
 * Azure 语音通道：请求自家 Worker 代理，拿回 mp3 播放。
 *
 * 为什么绕一层 Worker：Azure 的订阅 key 不能放前端。
 * 为什么单独成文件：系统语音通道在 tts.ts 里已经够长，两个通道各自独立更好维护。
 *
 * 播放失败一律回调 onEnd 而不抛错 —— 上层（tts.ts）据此做降级。
 */

import type { TtsLang } from './tts-settings';

export interface AzureVoice {
  id: string;
  lang: string;
  name: string;
}

export interface SpeakAzureOptions {
  lang: TtsLang;
  onEnd?: () => void;
  pitch: number;
  rate: number;
  voice: string;
}

/** 代理地址没配置时整个 Azure 通道不可用 */
export function isAzureConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TTS_PROXY_URL);
}

function proxyBase(): string {
  return import.meta.env.VITE_TTS_PROXY_URL ?? '';
}

/** 当前正在播放的音频与其 blob URL */
let current: { audio: HTMLAudioElement; url: string } | undefined;

/** 停掉 Azure 通道的播放并释放资源 */
export function stopAzure(): void {
  const playing = current;
  if (!playing) return;
  current = undefined;
  playing.audio.onended = null;
  playing.audio.onerror = null;
  playing.audio.pause();
  playing.audio.removeAttribute('src');
  URL.revokeObjectURL(playing.url);
}

export function speakAzure(text: string, options: SpeakAzureOptions): void {
  stopAzure();

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    options.onEnd?.();
  };

  if (!isAzureConfigured()) {
    finish();
    return;
  }

  void (async () => {
    let audio: HTMLAudioElement | undefined;
    let url = '';
    try {
      const response = await fetch(`${proxyBase()}/tts`, {
        body: JSON.stringify({
          lang: options.lang,
          pitch: options.pitch,
          rate: options.rate,
          text,
          voice: options.voice,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        finish();
        return;
      }
      const blob = await response.blob();
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      current = { audio, url };
      // 请求期间用户可能又点了别的，此时 current 已被替换，这段就作废
      if (current.audio !== audio) {
        URL.revokeObjectURL(url);
        finish();
        return;
      }
      audio.playbackRate = options.rate;
      audio.onended = () => {
        stopAzure();
        finish();
      };
      audio.onerror = () => {
        stopAzure();
        finish();
      };
      await audio.play();
    } catch {
      if (url) URL.revokeObjectURL(url);
      finish();
    }
  })();
}

export async function fetchAzureVoices(): Promise<AzureVoice[]> {
  const response = await fetch(`${proxyBase()}/voices`);
  if (!response.ok) throw new Error(`音色列表请求失败：${response.status}`);
  return (await response.json()) as AzureVoice[];
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run --dom apps/web-antd/src/utils/__tests__/tts-azure.test.ts`
Expected: PASS，10 passed

- [ ] **Step 5: Lint 并提交**

```bash
npx eslint --fix apps/web-antd/src/utils/tts-azure.ts apps/web-antd/src/utils/__tests__/tts-azure.test.ts
git add apps/web-antd/src/utils/tts-azure.ts apps/web-antd/src/utils/__tests__/tts-azure.test.ts
git commit -m "feat(kid): 新增 Azure 语音通道（走代理 Worker）"
```

---

### Task 4: `speak()` 路由与降级

**Files:**
- Modify: `apps/web-antd/src/utils/tts.ts`
- Test: `apps/web-antd/src/utils/__tests__/tts.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `getTtsSettings`；Task 3 的 `speakAzure` / `stopAzure` / `isAzureConfigured`
- Produces:
  - `function speak(text: string, options?: { lang?: TtsLang; onEnd?: () => void; rate?: number }): void`（签名不变）
  - `function isTtsEnabled(): boolean` / `function setTtsEnabled(enabled: boolean): void`（签名不变）
  - `function stopSpeak(): void`（现在同时停两个通道）
  - `function hasVoiceFor(lang: TtsLang): boolean` —— 供设置页判断系统语音是否覆盖该语言

- [ ] **Step 1: 写失败测试（追加到现有测试文件）**

在 `apps/web-antd/src/utils/__tests__/tts.test.ts` 末尾追加一个 `describe` 块。

**同时要把文件顶部的 import 改成**（`speakEnglish` 等到 Task 5 再删）：

```ts
import { hasVoiceFor, speak, setTtsEnabled, stopSpeak } from '#/utils/tts';
import {
  DEFAULT_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
} from '#/utils/tts-settings';
```

**关键**：系统语音通道要等音色就绪（`readyVoices` 是异步的），所以凡是走系统语音的
用例都必须用 `await vi.waitFor(...)` 断言，不能同步断言。

```ts
describe('speak 路由与降级', () => {
  /** 构造一个可控的假 speechSynthesis */
  function stubSynth(voices: { lang: string; name: string }[]) {
    const spoken: { lang: string; pitch: number; rate: number; text: string; voice: string }[] = [];
    vi.stubGlobal('speechSynthesis', {
      addEventListener: () => {},
      cancel: () => {},
      getVoices: () => voices.map((v) => ({ ...v, localService: true })),
      speak: (u: any) =>
        spoken.push({ lang: u.lang, pitch: u.pitch, rate: u.rate, text: u.text, voice: u.voice?.name ?? '' }),
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        lang = '';
        pitch = 1;
        rate = 1;
        text: string;
        voice: any = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    return spoken;
  }

  it('选定 azure 但未配置代理时，降级到系统语音而不是静默', async () => {
    stubLocalStorage();
    // 默认 source 就是 azure
    const spoken = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    vi.stubEnv('VITE_TTS_PROXY_URL', '');

    speak('你好', { onEnd: vi.fn() });

    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]!.text).toBe('你好');
  });

  it('源为 system 且该语言有音色时，走系统语音并套用设置的语速/音调/音色', async () => {
    stubLocalStorage();
    saveTtsSettings({
      ...DEFAULT_SETTINGS,
      pitch: 20,
      rate: 1.1,
      source: 'system',
      voices: { 'en-US': '', 'zh-CN': 'Xiaoxiao' },
    });
    const spoken = stubSynth([
      { lang: 'zh-CN', name: 'Xiaoxiao' },
      { lang: 'zh-CN', name: 'Huihui' },
    ]);

    speak('你好', { onEnd: vi.fn() });

    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]!.voice).toBe('Xiaoxiao');
    // Web Speech 的 pitch 是倍率，设置里存的是百分比：20% → 1.2
    expect(spoken[0]!.pitch).toBeCloseTo(1.2);
    expect(spoken[0]!.rate).toBeCloseTo(1.1);
  });

  it('源为 system 但该语言无音色、且 azure 不可用时静默，绝不用中文音色念英文', () => {
    stubLocalStorage();
    saveTtsSettings({ ...DEFAULT_SETTINGS, source: 'system' });
    // 只有中文音色，模拟本机 Chrome
    const spoken = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    vi.stubEnv('VITE_TTS_PROXY_URL', '');
    const onEnd = vi.fn();

    speak('apple', { lang: 'en-US', onEnd });

    expect(spoken).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('hasVoiceFor 反映系统音色的语言覆盖', () => {
    stubLocalStorage();
    stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    expect(hasVoiceFor('zh-CN')).toBe(true);
    expect(hasVoiceFor('en-US')).toBe(false);
  });

  it('语音开关关闭时两个通道都不出声', () => {
    stubLocalStorage();
    saveTtsSettings({ ...DEFAULT_SETTINGS, enabled: false, source: 'system' });
    const spoken = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    const onEnd = vi.fn();

    speak('你好', { onEnd });

    expect(spoken).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('setTtsEnabled(false) 会写入配置并停掉两个通道', () => {
    stubLocalStorage();
    stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);

    setTtsEnabled(false);

    expect(getTtsSettings().enabled).toBe(false);
  });
});
```

同步修改该文件顶部的 import：

```ts
import { hasVoiceFor, speak, setTtsEnabled, stopSpeak } from '#/utils/tts';
```

> 原有的 `speakEnglish` 相关测试（Task 5 会删除 `speakEnglish`）先保留不动，到 Task 5 一并处理。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run --dom apps/web-antd/src/utils/__tests__/tts.test.ts`
Expected: FAIL —— `hasVoiceFor is not a function`，以及路由相关断言失败

- [ ] **Step 3: 改造 `tts.ts`**

要点（按现有文件结构修改，不要重写整个文件）：

1. **顶部新增 import**：

```ts
import {
  getTtsSettings,
  saveTtsSettings,
  type TtsLang,
  type TtsSettings,
} from './tts-settings';
import { isAzureConfigured, speakAzure, stopAzure } from './tts-azure';
```

2. **删除** `isTtsEnabled` / `setTtsEnabled` 里直接操作 localStorage 的旧实现，改成走配置模块。
   常量 `TTS_ENABLED_KEY` 从 `tts.ts` **删除**（它已迁到 `tts-settings.ts` 作为旧键迁移用），
   否则会留下两个事实来源：

```ts
/** 是否启用语音（读写见 utils/tts-settings） */
export function isTtsEnabled(): boolean {
  return getTtsSettings().enabled;
}

export function setTtsEnabled(enabled: boolean) {
  const settings = getTtsSettings();
  saveTtsSettings({ ...settings, enabled });
  if (!enabled) stopSpeak();
}
```

（记得同时 `import { saveTtsSettings } from './tts-settings'`）

3. **新增系统音色就绪等待与语言覆盖判断**：

```ts
/**
 * 取当前可用音色。Edge 在页面加载瞬间返回 0 个，约 300ms 后才就绪，
 * 所以要等到 voiceschanged 或超时，避免首次朗读挑不到音色。
 */
function readyVoices(timeoutMs = 600): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const immediate = synth?.getVoices?.() ?? [];
  if (immediate.length > 0) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(synth?.getVoices?.() ?? []);
    };
    synth?.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

/** 系统语音是否覆盖该语言 */
export function hasVoiceFor(lang: TtsLang): boolean {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return hasVoiceIn(voices, lang);
}

function hasVoiceIn(voices: SpeechSynthesisVoice[], lang: string): boolean {
  const prefix = lang.slice(0, 2).toLowerCase();
  return voices.some((voice) => voice.lang.toLowerCase().startsWith(prefix));
}
```

4. **把 `speak()` 改成路由器**：

```ts
export function speak(
  text: string,
  options: { lang?: TtsLang; onEnd?: () => void; rate?: number } = {},
) {
  const settings = getTtsSettings();
  const lang: TtsLang = options.lang ?? resolveContentLang();

  if (!settings.enabled) {
    stopSpeak();
    options.onEnd?.();
    return;
  }

  // 选定源优先；该源对该语言不可用时切到另一个源；两个都不行才静默。
  // 注意「该语言不可用」不等于「没声音」：系统语音若没有 en-US 音色，
  // 用它读英文会退化成中文音素念英文，那正是最初的 bug，必须判定为不可用。
  const systemUsable = Boolean(window.speechSynthesis) && hasVoiceFor(lang);
  const azureUsable = isAzureConfigured();
  const preferred =
    settings.source === 'system'
      ? (systemUsable ? 'system' : azureUsable ? 'azure' : null)
      : (azureUsable ? 'azure' : systemUsable ? 'system' : null);

  if (preferred === 'system') {
    speakSystem(text, { ...options, lang, settings });
    return;
  }
  if (preferred === 'azure') {
    speakAzure(text, {
      lang,
      onEnd: options.onEnd,
      pitch: settings.pitch,
      // 调用点显式传的 rate 优先，否则用家长设置
      rate: options.rate ?? settings.rate,
      voice: settings.voices[lang],
    });
    return;
  }

  stopSpeak();
  options.onEnd?.();
}

/** 内容层语言：中文内容固定 zh-CN，其余跟随界面语言 */
function resolveContentLang(): TtsLang {
  return resolveTtsLang().startsWith('en') ? 'en-US' : 'zh-CN';
}
```

5. **新增 `speakSystem()`**（把原 `speak()` 的 Web Speech 逻辑搬进来，增加音色/音调/语速与就绪等待）：

```ts
function speakSystem(
  text: string,
  options: { lang: TtsLang; onEnd?: () => void; rate?: number; settings: TtsSettings },
) {
  stopAzure();
  const synth = window.speechSynthesis;
  if (!synth) {
    options.onEnd?.();
    return;
  }
  void readyVoices().then((voices) => {
    try {
      synth.cancel();
      const { lang, settings } = options;
      const utterance = new SpeechSynthesisUtterance(text);
      const picked =
        voices.find((voice) => voice.name === settings.voices[lang]) ??
        pickVoice(lang, voices);
      if (picked) {
        utterance.voice = picked;
        utterance.lang = picked.lang;
      }
      utterance.rate = options.rate ?? settings.rate;
      // Web Speech 的 pitch 是倍率（1 为原调），设置里存的是百分比
      utterance.pitch = 1 + settings.pitch / 100;
      utterance.onend = () => options.onEnd?.();
      utterance.onerror = () => options.onEnd?.();
      synth.speak(utterance);
    } catch {
      options.onEnd?.();
    }
  });
}
```

6. **`pickVoice` 改为接受音色数组**（避免重复调用 `getVoices()`）：

```ts
function pickVoice(lang: string, voices: SpeechSynthesisVoice[]) {
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((voice) => voice.lang === lang) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix))
  );
}
```

7. **`stopSpeak()` 同时停两个通道**：

```ts
export function stopSpeak() {
  stopAzure();
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}
```

> 顶部模块级预热的 `loadVoices` / `cachedVoices` 不再需要，删掉（`readyVoices` 取代它）。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run --dom apps/web-antd/src/utils/__tests__/tts.test.ts`
Expected: PASS（含旧测试；`speakEnglish` 相关测试此时仍应通过，因为该函数尚未删除）

- [ ] **Step 5: 类型检查**

Run: `pnpm -F @vben/web-antd run typecheck`
Expected: 无错误

- [ ] **Step 6: Lint 并提交**

```bash
npx eslint --fix apps/web-antd/src/utils/tts.ts apps/web-antd/src/utils/__tests__/tts.test.ts
git add apps/web-antd/src/utils/tts.ts apps/web-antd/src/utils/__tests__/tts.test.ts
git commit -m "feat(kid): speak 改为按语音源路由，源不可用时自动降级"
```

---

### Task 5: 移除有道通道，字母乐园回归统一管道

**Files:**
- Modify: `apps/web-antd/src/utils/tts.ts`（删除 `speakEnglish` / `stopEnglish`）
- Modify: `apps/web-antd/src/views/kid/hooks/use-quiz.ts`
- Modify: `apps/web-antd/src/views/kid/letters/index.vue`
- Test: `apps/web-antd/src/utils/__tests__/tts.test.ts`（删除 speakEnglish 相关测试）

**Interfaces:**
- Consumes: Task 4 的 `speak(text, { lang })`
- Produces: 字母乐园的 `sayLetter` / `sayWord` 回到统一管道

- [ ] **Step 1: 改调用点**

`use-quiz.ts` 的 `useLetterPractice`：

```ts
  /**
   * 每次点击只朗读一次英文，中文释义与例句显示在卡片上。
   *
   * 走统一的 speak()，由家长设置的语音源决定用哪个通道 ——
   * 不要在模块里绕过设置直连某个在线接口。
   */
  function sayLetter(item: { letter: string }) {
    speak(item.letter, { lang: 'en-US' });
  }

  function sayWord(item: { word: string }) {
    speak(item.word, { lang: 'en-US' });
  }
```

`use-quiz.ts` 顶部 import 去掉 `speakEnglish`：

```ts
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';
```

`letters/index.vue` 的 `ask`：

```ts
    // 题干是英文单词，读英文发音；中文问句已显示在页面上
    speak(meta.value.word, { lang: 'en-US' });
```

顶部 import 去掉 `speakEnglish`：

```ts
import { speak } from '#/utils/tts';
```

- [ ] **Step 2: 删除 `speakEnglish` / `stopEnglish`**

从 `apps/web-antd/src/utils/tts.ts` 删除这两个函数及其相关常量（`EN_TTS_ENDPOINT`、`EN_TTS_TYPE`、`enAudio`、`enFinish`）。

**迁移而不是丢弃**：把其中两处已验证的逻辑搬进 `tts-azure.ts`（Task 3 已经实现，此处只需确认一致）：
- `finish` 的幂等守卫（`settled` 标志）
- 停止时 `removeAttribute('src')` 释放底层请求

- [ ] **Step 3: 删除对应测试**

从 `apps/web-antd/src/utils/__tests__/tts.test.ts` 删除 `describe('speakEnglish', ...)` 整块及 `FakeAudio` 中仅供其使用的成员（若 `FakeAudio` 不再被引用则一并删除）。

- [ ] **Step 4: 全量测试**

Run: `pnpm vitest run --dom apps/web-antd/src/utils`
Expected: PASS，无残留引用

- [ ] **Step 5: 类型检查与全局搜索确认无残留**

```bash
pnpm -F @vben/web-antd run typecheck
grep -rn "speakEnglish\|EN_TTS_ENDPOINT\|enAudio" apps/web-antd/src || echo "无残留"
```

- [ ] **Step 6: Lint 并提交**

```bash
npx eslint --fix apps/web-antd/src/utils/tts.ts apps/web-antd/src/views/kid/hooks/use-quiz.ts apps/web-antd/src/views/kid/letters/index.vue apps/web-antd/src/utils/__tests__/tts.test.ts
git add -A apps/web-antd/src
git commit -m "refactor(kid): 移除有道通道，字母乐园改用统一 speak 管道"
```

---

### Task 6: 家长端设置界面

**Files:**
- Modify: `apps/web-antd/src/locales/langs/zh-CN/parent.json`
- Modify: `apps/web-antd/src/locales/langs/en-US/parent.json`
- Modify: `apps/web-antd/src/views/parent/settings/index.vue`
- Create: `apps/web-antd/src/views/parent/components/voice-settings.vue`

**Interfaces:**
- Consumes: Task 1 的 `getTtsSettings` / `saveTtsSettings` / `SUPPORTED_LANGS`；Task 3 的 `fetchAzureVoices` / `isAzureConfigured`；Task 4 的 `hasVoiceFor` / `setTtsEnabled`

> 拆出独立组件：设置页会从「两张卡片」变成一个带 6 个控件的表单，塞进 `index.vue` 会让该文件职责过载。

- [ ] **Step 1: 加 i18n（两份语言包都要加，`check:i18n` 会校验对称性）**

`zh-CN/parent.json` 的 `settings` 下新增：

```json
    "voiceTitle": "语音朗读",
    "voiceSource": "语音源",
    "sourceAzure": "微软 Azure",
    "sourceSystem": "系统语音",
    "voiceZh": "中文音色",
    "voiceEn": "英文音色",
    "voiceDefault": "使用默认音色",
    "voiceRate": "语速",
    "voicePitch": "音调",
    "voiceRateSlow": "慢",
    "voiceRateFast": "快",
    "voicePitchLow": "低",
    "voicePitchHigh": "高",
    "sourceUnavailable": "{source} 在当前设备上不可用，将自动改用另一个语音源",
    "allSourcesUnavailable": "当前设备没有可用的语音源，朗读将没有声音",
    "azureNotConfigured": "Azure 代理未配置，英文朗读可能没有声音",
    "voiceSaveFailed": "语音设置保存失败"
```

`en-US/parent.json` 的 `settings` 下新增对应英文文案：

```json
    "voiceTitle": "Voice",
    "voiceSource": "Voice source",
    "sourceAzure": "Microsoft Azure",
    "sourceSystem": "System voice",
    "voiceZh": "Chinese voice",
    "voiceEn": "English voice",
    "voiceDefault": "Use default voice",
    "voiceRate": "Speed",
    "voicePitch": "Pitch",
    "voiceRateSlow": "Slow",
    "voiceRateFast": "Fast",
    "voicePitchLow": "Low",
    "voicePitchHigh": "High",
    "sourceUnavailable": "{source} is unavailable on this device; the other source will be used instead",
    "allSourcesUnavailable": "No voice source is available on this device; reading will be silent",
    "azureNotConfigured": "Azure proxy is not configured; English may be silent",
    "voiceSaveFailed": "Failed to save voice settings"
```

- [ ] **Step 2: 新建组件**

创建 `apps/web-antd/src/views/parent/components/voice-settings.vue`：

```vue
<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Card, message, Select, Slider, Switch } from 'ant-design-vue';

import { $t } from '#/locales';
import { hasVoiceFor, setTtsEnabled } from '#/utils/tts';
import { fetchAzureVoices, isAzureConfigured } from '#/utils/tts-azure';
import {
  DEFAULT_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
  type TtsLang,
  type TtsSource,
} from '#/utils/tts-settings';

const settings = ref(getTtsSettings());
const azureVoices = ref<{ id: string; lang: string; name: string }[]>([]);
const systemVoices = ref<SpeechSynthesisVoice[]>([]);

const azureReady = computed(() => isAzureConfigured());
/** 当前源是否覆盖某种语言；不覆盖时设置页要给红字提示 */
const zhOk = computed(() => sourceCovers('zh-CN'));
const enOk = computed(() => sourceCovers('en-US'));

function sourceCovers(lang: TtsLang): boolean {
  if (settings.value.source === 'system') return hasVoiceFor(lang);
  return azureReady.value;
}

function voiceOptions(lang: TtsLang) {
  if (settings.value.source === 'system') {
    return systemVoices.value
      .filter((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2)))
      .map((voice) => ({ label: voice.name, value: voice.name }));
  }
  return azureVoices.value
    .filter((voice) => voice.lang === lang)
    .map((voice) => ({ label: voice.name, value: voice.id }));
}

/**
 * 只有开关变化时才走 setTtsEnabled —— 它会在关闭时停掉正在播放的语音。
 * 其它字段（音色/语速/音调）直接落盘即可，不要顺手多写一次。
 *
 * 写入失败必须让家长看见（隐私模式 / 配额满时的静默失败会让设置刷新即回退）。
 */
function persist() {
  if (!saveTtsSettings(settings.value)) {
    message.error($t('parent.settings.voiceSaveFailed'));
  }
}

function onEnabledChange(checked: boolean | number | string) {
  settings.value = { ...settings.value, enabled: Boolean(checked) };
  setTtsEnabled(settings.value.enabled);
  message.success(
    settings.value.enabled
      ? $t('parent.settings.ttsOn')
      : $t('parent.settings.ttsOff'),
  );
}

function onSourceChange(value: unknown) {
  settings.value = {
    ...settings.value,
    source: value as TtsSource,
    // 换源后旧音色 id 在新源里多半不存在，清空让各源用默认音色
    voices: { 'en-US': '', 'zh-CN': '' },
  };
  persist();
}

function onVoiceChange(lang: TtsLang, value: unknown) {
  settings.value = {
    ...settings.value,
    voices: { ...settings.value.voices, [lang]: String(value ?? '') },
  };
  persist();
}

function onRateChange(value: number | number[]) {
  settings.value = { ...settings.value, rate: Number(value) };
  persist();
}

function onPitchChange(value: number | number[]) {
  settings.value = { ...settings.value, pitch: Number(value) };
  persist();
}

async function loadVoices() {
  systemVoices.value = window.speechSynthesis?.getVoices?.() ?? [];
  window.speechSynthesis?.addEventListener?.(
    'voiceschanged',
    () => {
      systemVoices.value = window.speechSynthesis?.getVoices?.() ?? [];
    },
    { once: true },
  );
  if (!azureReady.value) return;
  try {
    azureVoices.value = await fetchAzureVoices();
  } catch {
    azureVoices.value = [];
  }
}

onMounted(loadVoices);
watch(() => settings.value.source, loadVoices);
</script>

<template>
  <Card :title="$t('parent.settings.voiceTitle')">
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <span class="text-base">{{ $t('parent.settings.tts') }}</span>
        <Switch
          :checked="settings.enabled"
          :checked-children="$t('parent.settings.on')"
          :un-checked-children="$t('parent.settings.off')"
          @change="onEnabledChange"
        />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-base">{{ $t('parent.settings.voiceSource') }}</span>
        <Select
          :value="settings.source"
          class="w-44"
          :options="[
            { label: $t('parent.settings.sourceAzure'), value: 'azure' },
            { label: $t('parent.settings.sourceSystem'), value: 'system' },
          ]"
          @change="onSourceChange"
        />
      </div>

      <div
        v-for="item in [
          { key: 'zh-CN' as TtsLang, label: 'voiceZh', ok: zhOk },
          { key: 'en-US' as TtsLang, label: 'voiceEn', ok: enOk },
        ]"
        :key="item.key"
      >
        <div class="flex items-center justify-between">
          <span class="text-base">{{ $t(`parent.settings.${item.label}`) }}</span>
          <Select
            :options="[
              { label: $t('parent.settings.voiceDefault'), value: '' },
              ...voiceOptions(item.key),
            ]"
            :value="settings.voices[item.key]"
            class="w-44"
            @change="(value: unknown) => onVoiceChange(item.key, value)"
          />
        </div>
        <p v-if="!item.ok" class="mt-1 text-xs text-red-500">
          {{
            $t('parent.settings.sourceUnavailable', {
              source:
                settings.source === 'azure'
                  ? $t('parent.settings.sourceAzure')
                  : $t('parent.settings.sourceSystem'),
            })
          }}
        </p>
      </div>

      <div>
        <div class="mb-1 flex justify-between text-sm">
          <span>{{ $t('parent.settings.voiceRate') }}</span>
          <span class="text-muted-foreground">{{ settings.rate.toFixed(2) }}</span>
        </div>
        <Slider
          :max="1.5"
          :min="0.5"
          :step="0.05"
          :value="settings.rate"
          @change="onRateChange"
        />
      </div>

      <div>
        <div class="mb-1 flex justify-between text-sm">
          <span>{{ $t('parent.settings.voicePitch') }}</span>
          <span class="text-muted-foreground">{{ settings.pitch }}</span>
        </div>
        <Slider
          :max="50"
          :min="-50"
          :step="5"
          :value="settings.pitch"
          @change="onPitchChange"
        />
      </div>

      <p v-if="!azureReady" class="text-xs text-amber-500">
        {{ $t('parent.settings.azureNotConfigured') }}
      </p>
      <p v-if="!zhOk && !enOk" class="text-xs text-red-500">
        {{ $t('parent.settings.allSourcesUnavailable') }}
      </p>
    </div>
  </Card>
</template>
```

- [ ] **Step 3: 设置页接入组件**

修改 `apps/web-antd/src/views/parent/settings/index.vue`：

- 删除原有 TTS 相关的 import（`isTtsEnabled` / `setTtsEnabled`）、`ttsEnabled` ref 与 `onTtsChange` 函数
- 删除模板里「语音」那一组 `Switch`（保留下方的 `deviceLearner` 部分）
- 在网格里插入新卡片：

```vue
  <div class="grid gap-5 p-5 lg:grid-cols-2">
    <Card :title="$t('parent.settings.childTitle')">…（不变）…</Card>

    <VoiceSettings />

    <Card :title="$t('parent.settings.dataTitle')">…（不变）…</Card>
  </div>
```

顶部加：

```ts
import VoiceSettings from '../components/voice-settings.vue';
```

- [ ] **Step 4: 类型检查与 i18n 校验**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm -F @vben/web-antd run check:i18n
```

Expected: 均无错误

- [ ] **Step 5: 手动验证**

启动开发服务器，打开家长端设置页，逐项确认：
1. 语音源切换后，音色下拉的选项随之变化
2. 选「系统语音」时英文音色下拉为空（本机 Windows Chrome 无英文音色），并出现红字提示
3. 切到「微软 Azure」后，中文/英文音色下拉能从代理拉取到列表（若代理未部署则显示警告）
4. 拖动语速/音调滑块后刷新页面，值被保留
5. 关掉语音开关，宝宝端朗读失效

- [ ] **Step 6: Lint 并提交**

```bash
npx eslint --fix apps/web-antd/src/views/parent
git add apps/web-antd/src/views/parent apps/web-antd/src/locales
git commit -m "feat(parent): 家长端新增语音源/音色/语速/音调设置"
```

---

### Task 7: 环境变量与部署文档

**Files:**
- Modify: `apps/web-antd/.env.example`（若不存在则创建）
- Create: `apps/tts-proxy/README.md`

**Interfaces:**
- Consumes: Task 3 的 `isAzureConfigured()`（读 `VITE_TTS_PROXY_URL`）
- Produces: 可复现的部署步骤

- [ ] **Step 1: 记录前端环境变量**

在 `apps/web-antd/.env.example` 中追加（`.env.production` 也要加上真实地址）：

```bash
# 语音代理 Worker 地址（见 apps/tts-proxy）。留空则英文朗读不可用。
VITE_TTS_PROXY_URL=http://localhost:8787
```

- [ ] **Step 2: 写部署文档**

创建 `apps/tts-proxy/README.md`：

```markdown
# TTS 代理 Worker

把 Azure 语音服务的订阅 key 挡在服务端，顺带缓存高频文本（引导语、表扬语）。

## 为什么需要它

Azure 的 `Ocp-Apim-Subscription-Key` 若放前端，任何人 F12 即可抄走并盗刷配额/账单。

## 部署

1. 申请 Azure AI Speech，创建 **F0 免费层**资源（每月 50 万字符，不超额计费），
   记下 key 与 region（如 `eastasia`）
2. 安装依赖并部署：

   ```bash
   cd apps/tts-proxy
   pnpm install
   npx wrangler secret put AZURE_SPEECH_KEY
   npx wrangler secret put AZURE_SPEECH_REGION
   npx wrangler deploy
   ```

3. 把 `wrangler.toml` 里的 `ALLOWED_ORIGIN` 改成前端真实域名后重新部署
4. 前端 `apps/web-antd/.env.production` 里把 `VITE_TTS_PROXY_URL` 指向 Worker 地址

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/voices` | 返回精选音色列表（白名单的单一事实来源） |
| POST | `/tts` | body `{ text, lang, voice?, rate?, pitch? }` → `audio/mpeg` |

`text` 上限 300 字符。超限返回 400，防止 Worker 被当作免费 TTS 代理刷爆额度。

## 上线前必须确认

- **不要升级到 S0 付费层**：当前架构假定 key 只在 Worker 里，但一旦产生真实账单，
  任何配额泄露都会变成钱。升级前先重新评估。
```

- [ ] **Step 3: 提交**

```bash
git add apps/tts-proxy/README.md apps/web-antd/.env.example
git commit -m "docs(tts-proxy): 补充部署步骤与环境变量说明"
```

---

### Task 8: ~~真机验证~~ —— 已决定跳过

> **2026-09-26 决策：本任务跳过。** 用户在「现在就跑 / 留到最后 / 跳过」里选择了跳过，
> 接受「移动端音色覆盖未知」这一风险。默认 `source = 'azure'` 不依赖系统音色，
> 因此该风险不影响主路径：即使移动端没有英文系统音色，Azure 通道仍能正常朗读。
> 下面是原本的验证步骤，保留备查 —— 日后若有人报告「移动端系统语音源读英文不正常」，
> 从这里开始查。

**Files:** 无代码改动，产出结论记录到 spec

**这是整个设计的核心假设验证，不通过则系统语音源在移动端的可用性不成立。**

- [ ] **Step 1: 在 iPad / 安卓平板上探测音色覆盖**

在目标设备的浏览器里打开宝宝端，进控制台执行：

```js
const v = speechSynthesis.getVoices();
const zh = v.filter(x => x.lang.toLowerCase().startsWith('zh'));
const en = v.filter(x => x.lang.toLowerCase().startsWith('en'));
console.log({ total: v.length, zh: zh.length, en: en.length });
console.table([...zh, ...en].map(x => ({ name: x.name, lang: x.lang, local: x.localService })));
```

- [ ] **Step 2: 实测朗读**

```js
['你好，我是晓晓', 'Hello, I am Ava'].forEach((text, i) => {
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices();
  const pick = i === 0
    ? v.find(x => x.lang.toLowerCase().startsWith('zh'))
    : v.find(x => x.lang.toLowerCase().startsWith('en'));
  if (pick) { u.voice = pick; u.lang = pick.lang; }
  u.onend = () => console.log('OK', text);
  u.onerror = (e) => console.log('FAIL', text, e.error);
  speechSynthesis.speak(u);
});
```

- [ ] **Step 3: 把结论写回 spec**

在 `docs/superpowers/specs/2026-09-26-tts-provider-settings-design.md` 的「第 3 节 已实测的接口约束」
表中追加 iPad / 安卓两行实测结果。**若英文音色缺失，需回头调整默认语音源**。

---

## 交付顺序说明

Task 1–7 可顺序执行，每步独立可测。**Task 8 是阻塞项**：若 iPad/安卓 缺英文音色，
`source` 的默认值需要从 `'azure'` 改为按设备能力推导，这会回改 Task 1 的 `DEFAULT_SETTINGS`
与 Task 4 的路由逻辑——所以真机验证越早做越好，最好在 Task 1 之前先跑。
