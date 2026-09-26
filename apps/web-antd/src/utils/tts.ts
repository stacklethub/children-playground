/**
 * 语音引导工具（Web Speech API）
 * 宝宝端所有页面通过 speak() 朗读引导语，可在设置中关闭。
 *
 * 朗读语言默认跟随界面语言（i18n locale）。学习内容是中文启蒙素材、
 * 不随界面语言切换，朗读这类内容时用 CONTENT_TTS_LANG 固定中文语音。
 */

import { $t, i18n } from '#/locales';

const TTS_ENABLED_KEY = 'child-study-tts-enabled';

/**
 * 学习内容的朗读语言。
 *
 * 内容层是中文单语（看图识物的名称与拼音、数字汉字、中文儿歌），不参与 i18n；
 * 因此无论界面切到哪种语言，内容朗读都应使用中文语音。
 */
export const CONTENT_TTS_LANG = 'zh-CN';

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

/**
 * 英文发音接口（有道词典），返回 mp3。
 *
 * 英文不走 Web Speech API：它只能用系统里装了的语音，设备没装英文语音包时，
 * 声明 lang='en-US' 会被浏览器直接静默，不声明又会被默认中文语音用中文字音念出来。
 * 在线音频与系统语音包无关，代价是需要联网。
 *
 * 选型时有两条硬约束，换接口前请先验证：
 * 1. 该接口只对字母、单词可靠。整句（例句）约 65% 会返回 500，不要传句子。
 * 2. 必须是不校验 Referer 的接口。百度 fanyi.baidu.com/gettts 对带 Referer 的
 *    请求返回空 body，而页面里的 <audio> 一定会带上本站 Referer
 *    （HTMLMediaElement 不支持 referrerPolicy，绕不过去），实测直接放不出来。
 */
const EN_TTS_ENDPOINT = 'https://dict.youdao.com/dictvoice';

/** 发音口音：1 美音 / 2 英音 */
const EN_TTS_TYPE = '1';

/** 正在播放的英文发音 */
let enAudio: HTMLAudioElement | undefined;

/**
 * 当前音频的结束回调。停止时一并清空，让这段音频的 finish 失效 ——
 * 否则「点了 A 又点 B」时，A 被 pause 触发的 play() 拒绝会再回调一次
 * A 的 onEnd，此时 B 已经在放了。
 */
let enFinish: (() => void) | undefined;

/** 停止英文发音 */
function stopEnglish() {
  const audio = enAudio;
  enAudio = undefined;
  enFinish = undefined;
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  // 只 pause 的话元素仍可能在后台把 mp3 缓冲完，连点会积压若干段在途请求，
  // 清掉 src 才能真正中止这次加载
  audio.removeAttribute('src');
  audio.load();
}

/**
 * 朗读英文。只传字母或单词 —— 见 EN_TTS_ENDPOINT 的说明，整句不可靠。
 * 会先停掉正在进行的中英文朗读，保证同一时刻只有一段声音。
 */
export function speakEnglish(
  text: string,
  options: { onEnd?: () => void } = {},
) {
  stopSpeak();
  if (!isTtsEnabled()) {
    options.onEnd?.();
    return;
  }
  try {
    const url = `${EN_TTS_ENDPOINT}?audio=${encodeURIComponent(text)}&type=${EN_TTS_TYPE}`;
    const audio = new Audio(url);
    enAudio = audio;
    // 加载失败会同时触发 error 事件和 play() 拒绝，两条路径都指向 finish，
    // 所以这里必须幂等，onEnd 只回调一次
    const finish = () => {
      if (enFinish !== finish) return;
      enFinish = undefined;
      if (enAudio === audio) enAudio = undefined;
      audio.onended = null;
      audio.onerror = null;
      options.onEnd?.();
    };
    enFinish = finish;
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
  } catch {
    options.onEnd?.();
  }
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
 *
 * @param options.lang 显式指定朗读语言，省略时跟随界面语言。
 *   朗读内容层中文素材时传 CONTENT_TTS_LANG。
 *
 * ⚠️ 不要在 onEnd 回调里紧接着再调一次 speak()：那样会在 onend 中执行
 *   cancel()，Chrome 的语音引擎会卡死且不报错，整个页面要刷新才恢复。
 *   需要连读多句时，改用单句或另行设计排队逻辑。
 */
export function speak(
  text: string,
  options: { lang?: string; onEnd?: () => void; rate?: number } = {},
) {
  stopEnglish();
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
    const lang = options.lang ?? resolveTtsLang();
    const utterance = new SpeechSynthesisUtterance(text);
    // 英文按词连读，语速略快于中文更自然
    utterance.rate = options.rate ?? (lang === 'en-US' ? 0.9 : 0.85);
    /**
     * 只有真的挑到匹配语音时才声明 lang。
     * 声明一个系统里并不存在的语言（例如未安装英文语音包时的 en-US），
     * 浏览器会直接静默 —— 一个字都不读，而不是回退到默认语音。
     * 挑不到就交给浏览器默认，至少能出声。
     */
    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
    synth.speak(utterance);
  } catch {
    options.onEnd?.();
  }
}

/** 停止当前朗读（中英文都停） */
export function stopSpeak() {
  stopEnglish();
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
