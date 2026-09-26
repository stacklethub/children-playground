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
let current: undefined | { audio: HTMLAudioElement; url: string };

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
