/**
 * 语音设置：家长可配置发音来源、音色、语速与音调。
 *
 * 只负责「配置的读写与校验」，不碰任何播放逻辑（播放见 utils/tts.ts）。
 * 用 localStorage 而非 pinia store：tts.ts 被 use-quiz.ts 等引用，
 * 走 store 会形成循环依赖。
 */

export type TtsSource = 'azure' | 'system' | 'youdao';
export type TtsLang = 'en-US' | 'zh-CN';

export const SUPPORTED_LANGS: TtsLang[] = ['zh-CN', 'en-US'];

/**
 * 音色标识。两条通道的标识空间不同，必须分开存：
 * azure 存的是音色 id（'zh-CN-XiaoxiaoNeural'），system 存的是
 * SpeechSynthesisVoice.name（'Microsoft Huihui - Chinese (Simplified, PRC)'）。
 * 挤在同一个字段里的话，某一通道存进去的值喂给另一通道只会被静默丢弃或拒绝。
 */
export interface TtsVoices {
  /** Azure 音色 id；空串表示用该源的默认音色 */
  azure: Record<TtsLang, string>;
  /** 系统语音名称；空串表示用该源的默认音色 */
  system: Record<TtsLang, string>;
  /**
   * 有道口音：'1' 美音 / '2' 英音；空串表示美音。
   * 有道没有多音色可选，只有这两种口音，所以这里存的不是音色 id。
   * 它只读英文，中文条目留着但不会被用到。
   */
  youdao: Record<TtsLang, string>;
}

export interface TtsSettings {
  enabled: boolean;
  /** 音调，百分比，与 Azure SSML / Web Speech pitch 量纲一致 */
  pitch: number;
  /** 语速倍率 */
  rate: number;
  source: TtsSource;
  /** 各通道各语言选定的音色 */
  voices: TtsVoices;
}

export const DEFAULT_SETTINGS: TtsSettings = {
  enabled: true,
  pitch: 0,
  rate: 0.9,
  source: 'azure',
  voices: {
    azure: { 'en-US': '', 'zh-CN': '' },
    system: { 'en-US': '', 'zh-CN': '' },
    youdao: { 'en-US': '', 'zh-CN': '' },
  },
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
  return {
    enabled:
      typeof input.enabled === 'boolean'
        ? input.enabled
        : DEFAULT_SETTINGS.enabled,
    pitch: clamp(input.pitch, MIN_PITCH, MAX_PITCH, DEFAULT_SETTINGS.pitch),
    rate: clamp(input.rate, MIN_RATE, MAX_RATE, DEFAULT_SETTINGS.rate),
    source:
      input.source === 'system' || input.source === 'youdao'
        ? input.source
        : 'azure',
    voices: normalizeVoices(input.voices),
  };
}

/**
 * 两条通道的音色各自规范化。
 *
 * 旧版本的扁平结构（voices['zh-CN'] 直接是字符串）在这里被丢弃：那个结构不区分
 * 通道，无法判断存的是 id 还是 name，怎么塞都会喂错其中一条通道。它没有随版本
 * 发布过（当时还没有设置界面），所以不需要迁移，空串即该通道的默认音色。
 */
function normalizeVoices(raw: unknown): TtsVoices {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    azure: pickVoiceIds(input.azure),
    system: pickVoiceIds(input.system),
    youdao: pickVoiceIds(input.youdao),
  };
}

function pickVoiceIds(raw: unknown): Record<TtsLang, string> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const voices: Record<TtsLang, string> = { 'en-US': '', 'zh-CN': '' };
  for (const lang of SUPPORTED_LANGS) {
    const value = input[lang];
    voices[lang] = typeof value === 'string' ? value : '';
  }
  return voices;
}

function readStorage(key: string): null | string {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
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
  // 新键是权威来源：只要它在，旧键就是待清理的残留，
  // 否则新键日后被清掉时残存的 '0' 会复活并再次关掉语音。
  if (readStorage(LEGACY_ENABLED_KEY) !== null) {
    removeStorage(LEGACY_ENABLED_KEY);
  }
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return normalize(undefined);
  }
}

/**
 * 写入设置。写入成功返回 `true`，失败（配额满、隐私模式、storage 被禁用）返回 `false`。
 *
 * 读路径的 try/catch 可以吞掉异常：读失败时回落默认值是可接受的降级，
 * 调用方拿到一个能用的配置，行为与「从未设置过」一致。
 * 写路径不能吞：写失败意味着家长改的值根本没落盘，若静默返回，
 * UI 会显示新值、刷新后却回退到旧值，且没有任何痕迹可循；
 * 因此把失败作为返回值暴露出去，由调用方决定是否提示家长。
 */
export function saveTtsSettings(settings: TtsSettings): boolean {
  return writeStorage(SETTINGS_KEY, JSON.stringify(normalize(settings)));
}

/** 旧版本只有 child-study-tts-enabled 一个开关，首次读取时迁移过来并删除旧键 */
function migrateLegacy(): TtsSettings {
  const legacy = readStorage(LEGACY_ENABLED_KEY);
  if (legacy === null) return normalize(undefined);
  const settings = normalize({ enabled: legacy !== '0' });
  // 只有写入成功才删旧键：写失败还删掉的话，家长的开关偏好就永久丢了，
  // 下次读取会回落到默认的 enabled: true
  if (saveTtsSettings(settings)) removeStorage(LEGACY_ENABLED_KEY);
  return settings;
}
