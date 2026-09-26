/**
 * Azure 语音通道：请求自家 Worker 代理，拿回 mp3 播放。
 *
 * 为什么绕一层 Worker：Azure 的订阅 key 不能放前端。
 * 为什么单独成文件：系统语音通道在 tts.ts 里已经够长，两个通道各自独立更好维护。
 *
 * 播放失败一律回调 onError（没给 onError 时退回 onEnd）而不抛错 —— 上层（tts.ts）据此做降级。
 */

import type { TtsLang } from './tts-settings';

export interface AzureVoice {
  id: string;
  lang: string;
  name: string;
}

export interface SpeakAzureOptions {
  lang: TtsLang;
  /**
   * 请求失败、返回非 2xx、play() 被拒时回调。给了它就**不再**回调 onEnd：
   * 收尾交给上层，它才知道该降级到哪个通道（F5）。
   */
  onError?: () => void;
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
let current: undefined | { audio: HTMLAudioElement; url: string };

/**
 * 播放代次：stopAzure() 与每次 speakAzure() 都会 +1。
 *
 * 每次 speakAzure 记下自己的代次，并在每个 await 之后比对：不相等就说明这次已被
 * 更新的一次播放（或一次 stop）取代，必须彻底放手 —— 不播、不动 current、
 * 不释放别人的 blob URL、也不回调。没有它的话，两次连点会同时出声、
 * 旧的一次漏掉 blob URL，而它的 onerror 还会拆掉新那段的音频。
 */
let generation = 0;

/** 只停播放、释放资源，不作废代次（播放自然结束/出错时的内部收尾用） */
function teardown(): void {
  const playing = current;
  if (!playing) return;
  current = undefined;
  playing.audio.onended = null;
  playing.audio.onerror = null;
  playing.audio.pause();
  playing.audio.removeAttribute('src');
  // 只清 src 的话元素仍可能在后台把 mp3 缓冲完，而 Azure 是按请求计费的
  playing.audio.load();
  URL.revokeObjectURL(playing.url);
}

/** 停掉 Azure 通道的播放并释放资源，同时作废所有在途请求 */
export function stopAzure(): void {
  generation += 1;
  teardown();
}

export function speakAzure(text: string, options: SpeakAzureOptions): void {
  stopAzure();
  const myGen = ++generation;

  let settled = false;
  /** 播完的收尾。已被取代时静默退场：迟到的 onEnd 会让上层误以为「这段放完了」 */
  const finish = () => {
    if (settled || myGen !== generation) return;
    settled = true;
    options.onEnd?.();
  };
  /** 失败的收尾。给了 onError 就交给它（上层据此降级），没有再退回 onEnd */
  const fail = () => {
    if (settled || myGen !== generation) return;
    settled = true;
    if (options.onError) options.onError();
    else options.onEnd?.();
  };

  if (!isAzureConfigured()) {
    fail();
    return;
  }

  void (async () => {
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
      // 请求期间用户可能又点了别的：这次的结果作废，连 blob URL 都不该建
      if (myGen !== generation) return;
      if (!response.ok) {
        fail();
        return;
      }
      const blob = await response.blob();
      if (myGen !== generation) return;

      url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      current = { audio, url };
      audio.playbackRate = options.rate;
      audio.onended = () => {
        teardown();
        finish();
      };
      audio.onerror = () => {
        teardown();
        fail();
      };
      await audio.play();
    } catch {
      // 被新的一次播放顶掉时 stopAzure 已经释放过这个 URL，重复撤销没有意义
      if (url && myGen === generation) URL.revokeObjectURL(url);
      fail();
    }
  })();
}

export async function fetchAzureVoices(): Promise<AzureVoice[]> {
  const response = await fetch(`${proxyBase()}/voices`);
  if (!response.ok) throw new Error(`音色列表请求失败：${response.status}`);
  return (await response.json()) as AzureVoice[];
}
