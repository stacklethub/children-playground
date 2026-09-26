/**
 * 有道语音通道：直接播放词典发音音频，不需要任何代理或 key。
 *
 * 与 Azure 通道的关键差别是**能力范围**，路由层必须知道：
 * 实测中文句子 8/8 返回 500（含「妈妈」这类常用词），英文整句约 65% 失败，
 * 只有英文字母与单词是 100% 可靠的。所以传进来的只应是英文单词或字母；
 * 中文必须由路由层交给别的通道。
 *
 * 播放失败一律回调 onError（没给 onError 时退回 onEnd）而不抛错 —— 上层据此降级。
 */

import type { TtsLang } from './tts-settings';

/**
 * 有道发音接口。换接口前先验证两条硬约束：
 * 1. 只对字母、单词可靠（整句与中文大量返回 500）。
 * 2. 必须不校验 Referer —— 页面里的 <audio> 一定会带上本站 Referer，
 *    而 HTMLMediaElement 不支持 referrerPolicy，绕不过去。
 *    百度 fanyi.baidu.com/gettts 就是栽在这条上（带 Referer 返回空 body）。
 */
const ENDPOINT = 'https://dict.youdao.com/dictvoice';

/** 口音 id：1 美音 / 2 英音；空串视为美音 */
export const DEFAULT_ACCENT = '1';

export interface SpeakYoudaoOptions {
  /** 口音 id，见 DEFAULT_ACCENT */
  accent: string;
  lang: TtsLang;
  onEnd?: () => void;
  /**
   * 加载失败、播放被拒时回调。给了它就**不再**回调 onEnd：
   * 收尾交给上层，它才知道该降级到哪个通道。
   */
  onError?: () => void;
  rate: number;
}

/** 当前正在播放的音频 */
let current: HTMLAudioElement | undefined;

/**
 * 播放代次：stopYoudao() 与每次 speakYoudao() 都会 +1。
 *
 * 每次播放记下自己的代次，收尾前比对：不相等就说明已被更新的一次播放
 * （或一次 stop）取代，必须彻底放手 —— 不停别人的音频、也不回调。
 */
let generation = 0;

/**
 * 只停播放、释放资源，不作废代次。
 *
 * 清 src 之后必须 load()：只 pause 的话元素仍可能在后台把 mp3 缓冲完，
 * 连点会积压若干段在途请求。
 */
function teardown(): void {
  const audio = current;
  if (!audio) return;
  current = undefined;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

/** 停掉有道通道的播放并释放资源，同时作废所有在途播放 */
export function stopYoudao(): void {
  generation += 1;
  teardown();
}

export function speakYoudao(text: string, options: SpeakYoudaoOptions): void {
  stopYoudao();
  const myGen = ++generation;

  let settled = false;
  /**
   * 收尾。三条路径都指向它（播放结束、error 事件、play() 拒绝），所以必须幂等；
   * 代次判断则保证迟到的那次不会拆掉后来的音频 —— teardown() 操作的是模块级的
   * current，不判断代次的话，旧音频迟到的 play() 拒绝会把新音频一起停掉。
   */
  const settle = (ok: boolean) => {
    if (settled || myGen !== generation) return;
    settled = true;
    teardown();
    if (ok) {
      options.onEnd?.();
      return;
    }
    if (options.onError) options.onError();
    else options.onEnd?.();
  };

  try {
    const accent = options.accent || DEFAULT_ACCENT;
    const url = `${ENDPOINT}?audio=${encodeURIComponent(text)}&type=${accent}`;
    const audio = new Audio(url);
    current = audio;
    audio.playbackRate = options.rate;
    audio.onended = () => settle(true);
    audio.onerror = () => settle(false);
    // play() 的拒绝不是元素上的事件，stop 时置空 handler 拦不住它，必须自己判断代次
    audio.play().catch(() => settle(false));
  } catch {
    settle(false);
  }
}
