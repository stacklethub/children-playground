/**
 * 语音引导工具（Web Speech API）
 * 宝宝端所有页面通过 speak() 朗读引导语，可在设置中关闭。
 *
 * 朗读语言默认跟随界面语言（i18n locale）。学习内容是中文启蒙素材、
 * 不随界面语言切换，朗读这类内容时用 CONTENT_TTS_LANG 固定中文语音。
 */

import { $t, i18n } from '#/locales';

import { isAzureConfigured, speakAzure, stopAzure } from './tts-azure';
import {
  getTtsSettings,
  saveTtsSettings,
  type TtsLang,
  type TtsSettings,
  type TtsSource,
} from './tts-settings';

/**
 * 学习内容的朗读语言。
 *
 * 内容层是中文单语（看图识物的名称与拼音、数字汉字、中文儿歌），不参与 i18n；
 * 因此无论界面切到哪种语言，内容朗读都应使用中文语音。
 */
export const CONTENT_TTS_LANG = 'zh-CN';

/** 是否启用语音（读写见 utils/tts-settings） */
export function isTtsEnabled(): boolean {
  return getTtsSettings().enabled;
}

/** 写入成功返回 true；失败返回 false（设置页据此提示，别让保存静默失败） */
export function setTtsEnabled(enabled: boolean): boolean {
  const settings = getTtsSettings();
  const saved = saveTtsSettings({ ...settings, enabled });
  if (!enabled) stopSpeak();
  return saved;
}

/** 当前界面语言对应的朗读语言 */
function resolveTtsLang(): string {
  const locale = i18n.global.locale.value;
  return locale?.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

/** 内容层语言：中文内容固定 zh-CN，其余跟随界面语言 */
function resolveContentLang(): TtsLang {
  return resolveTtsLang().startsWith('en') ? 'en-US' : 'zh-CN';
}

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

/** 系统语音是否覆盖该语言。判定前先等音色就绪，见 pickChannel 的说明 */
async function isSystemUsable(lang: TtsLang): Promise<boolean> {
  if (!window.speechSynthesis) return false;
  return hasVoiceIn(await readyVoices(), lang);
}

/** 挑选与朗读语言匹配的系统语音，缺失时回退到同语系语音 */
function pickVoice(lang: string, voices: SpeechSynthesisVoice[]) {
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((voice) => voice.lang === lang) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix))
  );
}

/** 走系统语音通道朗读 */
function speakSystem(
  text: string,
  options: {
    lang: TtsLang;
    onEnd?: () => void;
    rate?: number;
    settings: TtsSettings;
  },
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
        voices.find((voice) => voice.name === settings.voices.system[lang]) ??
        pickVoice(lang, voices);
      /**
       * 只有真的挑到匹配语音时才声明 lang。
       * 声明一个系统里并不存在的语言（例如未安装英文语音包时的 en-US），
       * 浏览器会直接静默 —— 一个字都不读，而不是回退到默认语音。
       * 挑不到就交给浏览器默认，至少能出声。
       */
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

/**
 * 朗读代次。每次 speak() 递增，异步选路完成后据此判断自己是否已被更新的一次点击取代 ——
 * 没有它的话，先发起的那次会在 await 之后继续播，盖住后发起的那次。
 */
let speakGeneration = 0;

type TtsChannel = 'azure' | 'system';

/**
 * 选定这一句走哪条通道：选定源优先，该源对该语言不可用时切到另一个源，
 * 两个都不行返回 null（静默，但仍回调 onEnd）。
 *
 * 判定必须等音色就绪：Edge 在页面加载瞬间 getVoices() 返回空，约 300ms 后才到。
 * 同步判定会把「系统音色其实能用」误判成不可用，而那正好是首次点击静默的原因。
 * 选定 azure 且代理已配置时不必等，省掉一次 voiceschanged 的延迟。
 *
 * 注意「该语言不可用」不等于「没声音」：系统语音若没有 en-US 音色，
 * 用它读英文会退化成中文音素念英文，那正是最初的 bug，必须判定为不可用。
 */
async function pickChannel(
  source: TtsSource,
  lang: TtsLang,
): Promise<null | TtsChannel> {
  const azureUsable = isAzureConfigured();
  if (source === 'azure' && azureUsable) return 'azure';

  const systemUsable = await isSystemUsable(lang);
  if (source === 'system') {
    if (systemUsable) return 'system';
    return azureUsable ? 'azure' : null;
  }
  return systemUsable ? 'system' : null;
}

/**
 * 朗读文本：按家长选定的语音源路由，选定源对该语言不可用时自动切到另一个源，
 * 两个都不可用才静默（此时仍回调 onEnd，不让调用方卡住）。
 *
 * 立即返回：选路要等音色就绪，是异步的，播放与 onEnd 都在选路之后发生。
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
  options: { lang?: TtsLang; onEnd?: () => void; rate?: number } = {},
) {
  const settings = getTtsSettings();
  const lang: TtsLang = options.lang ?? resolveContentLang();

  if (!settings.enabled) {
    stopSpeak();
    options.onEnd?.();
    return;
  }

  // 先同步掐断所有通道再谈选路：新的一次点击必须立刻让旧声音停下来，
  // 不能拖到 await 之后 —— 只停自己那条通道也不行，中文会压在 Azure 音频底下继续念。
  stopSpeak();

  const myGen = ++speakGeneration;
  void pickChannel(settings.source, lang).then((preferred) => {
    // 选路期间用户又点了别的：这次已经作废，不播，也不回调 onEnd
    if (myGen !== speakGeneration) return;

    if (preferred === 'system') {
      speakSystem(text, { ...options, lang, settings });
      return;
    }
    if (preferred === 'azure') {
      speakAzure(text, {
        lang,
        onEnd: options.onEnd,
        onError: () => {
          // Azure 运行时失败（worker 502、超长文本被拒、超时）不能让整个应用哑掉：
          // 系统语音能读这门语言就降级过去，否则才认输回调 onEnd。
          // 不能降到读不了这门语言的通道，那会退化成用中文音色念英文。
          void isSystemUsable(lang).then((usable) => {
            if (myGen !== speakGeneration) return;
            if (usable) speakSystem(text, { ...options, lang, settings });
            else options.onEnd?.();
          });
        },
        pitch: settings.pitch,
        // 调用点显式传的 rate 优先，否则用家长设置
        rate: options.rate ?? settings.rate,
        voice: settings.voices.azure[lang],
      });
      return;
    }

    options.onEnd?.();
  });
}

/** 停止当前朗读（Azure 与系统语音两个通道都停） */
export function stopSpeak() {
  stopAzure();
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
