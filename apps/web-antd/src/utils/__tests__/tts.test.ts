import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { speak, speakEnglish, stopSpeak } from '#/utils/tts';

/**
 * 英文发音走在线音频（不依赖系统英文语音包）。
 *
 * 背景：设备未安装英文语音时，Web Speech API 要么静默、要么退化成中文语音念英文；
 * 因此英文改用 <audio> 播放词典发音。这里用假的 Audio 捕获播放行为，
 * 断言「播的是哪段 URL」和「连播时旧音频有没有被停掉」。
 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  /** 记录 load() 调用次数，用来断言停止时确实释放了 src */
  loadedTimes = 0;
  onended: (() => void) | null = null;

  onerror: (() => void) | null = null;
  paused = true;
  src: string;
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  static playImpl: () => Promise<void> = () => Promise.resolve();

  load(): void {
    this.loadedTimes += 1;
  }

  pause(): void {
    this.paused = true;
  }

  play(): Promise<void> {
    this.paused = false;
    return FakeAudio.playImpl();
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }
}

const TTS_ENABLED_KEY = 'child-study-tts-enabled';

/** happy-dom 不提供 localStorage，用内存版顶替，行为与浏览器一致 */
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  });
}

function lastAudio(): FakeAudio {
  const audio = FakeAudio.instances.at(-1);
  if (!audio) throw new Error('没有创建任何音频');
  return audio;
}

describe('speakEnglish', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.playImpl = () => Promise.resolve();
    stubLocalStorage();
    vi.stubGlobal('Audio', FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('请求有道发音接口，带上文本与口音参数', () => {
    speakEnglish('apple');

    const url = new URL(lastAudio().src);
    expect(url.origin + url.pathname).toBe('https://dict.youdao.com/dictvoice');
    expect(url.searchParams.get('audio')).toBe('apple');
    expect(url.searchParams.get('type')).toBe('1');
  });

  it('文本里的空格会被正确转义', () => {
    speakEnglish('ice cream');

    expect(new URL(lastAudio().src).searchParams.get('audio')).toBe(
      'ice cream',
    );
  });

  it('播放新的英文发音前先停掉上一段，避免两段声音叠在一起', () => {
    speakEnglish('apple');
    const first = lastAudio();

    speakEnglish('bear');

    expect(first.paused).toBe(true);
    expect(FakeAudio.instances).toHaveLength(2);
    expect(lastAudio().paused).toBe(false);
  });

  it('音频播完时回调 onEnd', async () => {
    const onEnd = vi.fn();
    speakEnglish('apple', { onEnd });

    lastAudio().onended?.();

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('音频加载失败时也回调 onEnd，不让调用方卡住', () => {
    const onEnd = vi.fn();
    speakEnglish('apple', { onEnd });

    lastAudio().onerror?.();

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('加载失败同时触发 error 事件与 play() 拒绝时，onEnd 只回调一次', async () => {
    FakeAudio.playImpl = () => Promise.reject(new Error('NotSupportedError'));
    const onEnd = vi.fn();
    speakEnglish('apple', { onEnd });

    const audio = lastAudio();
    audio.onerror?.();
    await vi.waitFor(() => expect(audio.onended).toBeNull());

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('播放被浏览器拒绝（缺少用户手势）时不抛错，仍然回调 onEnd', async () => {
    FakeAudio.playImpl = () => Promise.reject(new Error('NotAllowedError'));
    const onEnd = vi.fn();

    expect(() => speakEnglish('apple', { onEnd })).not.toThrow();

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it('语音开关关闭时不播放，但仍回调 onEnd', () => {
    localStorage.setItem(TTS_ENABLED_KEY, '0');
    const onEnd = vi.fn();

    speakEnglish('apple', { onEnd });

    expect(FakeAudio.instances).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stopSpeak 会停掉正在播放的英文发音并释放 src', () => {
    speakEnglish('apple');
    const audio = lastAudio();

    stopSpeak();

    expect(audio.paused).toBe(true);
    expect(audio.src).toBe('');
    expect(audio.loadedTimes).toBe(1);
  });

  it('已被停掉的音频不再回调 onEnd（连点时旧音频不能盖过新的）', async () => {
    FakeAudio.playImpl = () => Promise.reject(new Error('AbortError'));
    const onEndA = vi.fn();
    speakEnglish('apple', { onEnd: onEndA });
    const audioA = lastAudio();

    speakEnglish('bear');

    // 等一个宏任务，确保 A 的 play() 拒绝回调已经跑完
    await new Promise((resolve) => setTimeout(resolve, 0));

    // A 被 pause 后 play() 拒绝，此时 B 已经在放，A 的 onEnd 不应再触发
    expect(audioA.paused).toBe(true);
    expect(onEndA).not.toHaveBeenCalled();
  });

  it('中文朗读开始前会停掉英文发音，避免中英同时出声', () => {
    speakEnglish('apple');
    const audio = lastAudio();

    speak('点一点字母');

    expect(audio.paused).toBe(true);
  });
});
