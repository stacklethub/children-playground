import type { SynthRequest } from './ssml';

import { findVoice, type TtsLang } from './voices';

/** 单次合成的文本上限，防止 worker 被当作免费 TTS 代理刷爆 Azure 额度 */
export const MAX_TEXT_LENGTH = 300;
const SUPPORTED_LANGS: TtsLang[] = ['zh-CN', 'en-US'];
const DEFAULT_RATE = 0.9;
const DEFAULT_PITCH = 0;

export type ParseResult =
  | { ok: false; error: string }
  | { ok: true; value: SynthRequest };

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
