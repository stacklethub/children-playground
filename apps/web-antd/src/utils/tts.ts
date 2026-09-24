/**
 * 语音引导工具（Web Speech API）
 * 宝宝端所有页面通过 speak() 朗读引导语，可在设置中关闭。
 * 朗读语言跟随界面语言（i18n locale）切换。
 */

import { $t, i18n } from '#/locales';

const TTS_ENABLED_KEY = 'child-study-tts-enabled';

/** 是否启用语音（独立于 store，避免循环依赖） */
export function isTtsEnabled(): boolean {
  return localStorage.getItem(TTS_ENABLED_KEY) !== '0';
}

export function setTtsEnabled(enabled: boolean) {
  localStorage.setItem(TTS_ENABLED_KEY, enabled ? '1' : '0');
  if (!enabled) {
    stopSpeak();
  }
}

/** 当前界面语言对应的朗读语言 */
function resolveTtsLang(): string {
  const locale = i18n.global.locale.value;
  return locale?.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

/**
 * 系统语音列表在部分浏览器中是异步就绪的，这里做一次预热缓存，
 * 避免首次朗读时 getVoices() 返回空数组而退化成默认语音。
 */
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis?.getVoices?.() ?? [];
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

/** 挑选与朗读语言匹配的系统语音，缺失时回退到同语系语音 */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices =
    cachedVoices.length > 0
      ? cachedVoices
      : (window.speechSynthesis?.getVoices?.() ?? []);
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

/**
 * 朗读文本。语音未启用或浏览器不支持时静默降级。
 */
export function speak(
  text: string,
  options: { onEnd?: () => void; rate?: number } = {},
) {
  if (!isTtsEnabled()) {
    options.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) {
    options.onEnd?.();
    return;
  }
  try {
    synth.cancel();
    const lang = resolveTtsLang();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    // 英文按词连读，语速略快于中文更自然
    utterance.rate = options.rate ?? (lang === 'en-US' ? 0.9 : 0.85);
    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
    synth.speak(utterance);
  } catch {
    options.onEnd?.();
  }
}

/** 停止当前朗读 */
export function stopSpeak() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}

/** 随机读取一句鼓励语（文案走 i18n） */
const PRAISE_KEYS = [
  'kid.tts.praise1',
  'kid.tts.praise2',
  'kid.tts.praise3',
  'kid.tts.praise4',
  'kid.tts.praise5',
];

export function speakPraise() {
  const key = PRAISE_KEYS[Math.floor(Math.random() * PRAISE_KEYS.length)]!;
  speak($t(key), { rate: 0.95 });
}

const ENCOURAGE_KEYS = [
  'kid.tts.encourage1',
  'kid.tts.encourage2',
  'kid.tts.encourage3',
];

export function speakEncourage() {
  const key =
    ENCOURAGE_KEYS[Math.floor(Math.random() * ENCOURAGE_KEYS.length)]!;
  speak($t(key), { rate: 0.95 });
}
