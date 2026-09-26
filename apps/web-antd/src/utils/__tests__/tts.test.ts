import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasVoiceFor,
  setTtsEnabled,
  speak,
} from '#/utils/tts';
import {
  DEFAULT_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
} from '#/utils/tts-settings';

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
  playbackRate = 1;
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
describe('speak 路由与降级', () => {
  interface VoiceStub {
    lang: string;
    name: string;
  }

  /**
   * 可控的假 speechSynthesis。
   *
   * 默认 getVoices() 立刻返回给定音色；初始传空数组时用 ready() 模拟「音色晚到」，
   * 那是 Edge 首屏的真实时序，也是选路误判导致首次点击静默的成因。
   */
  function stubSynth(initialVoices: VoiceStub[] = []) {
    const state = { voices: initialVoices };
    const spoken: {
      lang: string;
      pitch: number;
      rate: number;
      text: string;
      voice: string;
    }[] = [];
    const listeners: (() => void)[] = [];
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', {
      addEventListener: (_type: string, listener: () => void) => {
        listeners.push(listener);
      },
      cancel,
      getVoices: () =>
        state.voices.map((voice) => ({ ...voice, localService: true })),
      speak: (u: any) =>
        spoken.push({
          lang: u.lang,
          pitch: u.pitch,
          rate: u.rate,
          text: u.text,
          voice: u.voice?.name ?? '',
        }),
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
    return {
      cancel,
      spoken,
      /** 模拟 voiceschanged：音色到这一刻才可用 */
      ready(voices: VoiceStub[]) {
        state.voices = voices;
        for (const listener of listeners.splice(0)) listener();
      },
    };
  }

  /** 每次返回不同的 blob URL，方便断言「撤销的是哪一段」 */
  function stubUrl() {
    let sequence = 0;
    const createObjectURL = vi.fn(() => `blob:fake:${(sequence += 1)}`);
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
  }

  /** 让 Azure 通道合成成功 */
  function stubAzureAudio() {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(blob, { status: 200 })),
    );
    vi.stubGlobal('Audio', FakeAudio);
    FakeAudio.instances = [];
    stubUrl();
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('选定 azure 但未配置代理时，降级到系统语音而不是静默', async () => {
    stubLocalStorage();
    // 默认 source 就是 azure
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    vi.stubEnv('VITE_TTS_PROXY_URL', '');

    speak('你好', { onEnd: vi.fn() });

    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1));
    expect(synth.spoken[0]!.text).toBe('你好');
  });

  it('源为 system 且该语言有音色时，走系统语音并套用设置的语速/音调/音色', async () => {
    stubLocalStorage();
    saveTtsSettings({
      ...DEFAULT_SETTINGS,
      pitch: 20,
      rate: 1.1,
      source: 'system',
      voices: {
        azure: { 'en-US': '', 'zh-CN': '' },
        system: { 'en-US': '', 'zh-CN': 'Xiaoxiao' },
      },
    });
    const synth = stubSynth([
      { lang: 'zh-CN', name: 'Xiaoxiao' },
      { lang: 'zh-CN', name: 'Huihui' },
    ]);

    speak('你好', { onEnd: vi.fn() });

    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1));
    expect(synth.spoken[0]!.voice).toBe('Xiaoxiao');
    // Web Speech 的 pitch 是倍率，设置里存的是百分比：20% → 1.2
    expect(synth.spoken[0]!.pitch).toBeCloseTo(1.2);
    expect(synth.spoken[0]!.rate).toBeCloseTo(1.1);
  });

  it('源为 system 但该语言无音色、且 azure 不可用时静默，绝不用中文音色念英文', async () => {
    stubLocalStorage();
    saveTtsSettings({ ...DEFAULT_SETTINGS, source: 'system' });
    // 只有中文音色，模拟本机 Chrome
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    vi.stubEnv('VITE_TTS_PROXY_URL', '');
    const onEnd = vi.fn();

    speak('apple', { lang: 'en-US', onEnd });

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
    expect(synth.spoken).toHaveLength(0);
  });

  it('音色晚到时也照常朗读：首屏 getVoices() 为空不再导致首次点击静默（F2）', async () => {
    stubLocalStorage();
    saveTtsSettings({ ...DEFAULT_SETTINGS, source: 'system' });
    vi.stubEnv('VITE_TTS_PROXY_URL', '');
    const synth = stubSynth();
    const onEnd = vi.fn();

    speak('你好', { onEnd });
    // Edge 的真实时序：点击那一刻音色还没到，约 300ms 后才来
    synth.ready([{ lang: 'zh-CN', name: 'Huihui' }]);

    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1));
    expect(synth.spoken[0]!.text).toBe('你好');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('连点两次只播一次：先发起的那次不能盖过后发起的那次（F2）', async () => {
    stubLocalStorage();
    saveTtsSettings({ ...DEFAULT_SETTINGS, source: 'system' });
    vi.stubEnv('VITE_TTS_PROXY_URL', '');
    const synth = stubSynth();
    const onEndA = vi.fn();
    const onEndB = vi.fn();

    // 两次都卡在等音色就绪上，谁也不会同步播出去
    speak('第一句', { onEnd: onEndA });
    speak('第二句', { onEnd: onEndB });
    synth.ready([{ lang: 'zh-CN', name: 'Huihui' }]);

    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1));
    // 多等一轮宏任务，让被放弃的那次有机会（错误地）补播
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]!.text).toBe('第二句');
    // 被放弃的那次连 onEnd 都不该回调，否则调用方会以为它放完了
    expect(onEndA).not.toHaveBeenCalled();
    expect(onEndB).not.toHaveBeenCalled();
  });

  it('路由到 azure 时也取消系统语音，中文不会压在 Azure 音频底下继续念（F1）', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_TTS_PROXY_URL', 'https://tts.example');
    stubAzureAudio();
    // 中文朗读正在走系统通道，此时切到 azure
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);

    speak('你好', { onEnd: vi.fn() });

    // 同步就掐断：等选路 await 之后再停，中文会和 Azure 那段叠着放
    expect(synth.cancel).toHaveBeenCalled();
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
  });

  it('azure 播放失败且系统音色能读这门语言时，降级到系统语音（F5）', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_TTS_PROXY_URL', 'https://tts.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 502 })),
    );
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    const onEnd = vi.fn();

    speak('你好', { onEnd });

    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1));
    expect(synth.spoken[0]!.text).toBe('你好');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('azure 失败且系统没有这门语言的音色时，保持静默并回调 onEnd（F5）', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_TTS_PROXY_URL', 'https://tts.example');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 502 })),
    );
    // 只有英文音色：拿它读中文等于用英文音素念中文，不能算「可用」
    const synth = stubSynth([{ lang: 'en-US', name: 'Ava' }]);
    const onEnd = vi.fn();

    speak('你好', { onEnd });

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
    expect(synth.spoken).toHaveLength(0);
  });

  it('azure 播放成功时不触发降级（F5）', async () => {
    stubLocalStorage();
    vi.stubEnv('VITE_TTS_PROXY_URL', 'https://tts.example');
    stubAzureAudio();
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    const onEnd = vi.fn();

    speak('你好', { onEnd });

    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    expect(FakeAudio.instances[0]!.paused).toBe(false);
    expect(synth.spoken).toHaveLength(0);
    expect(onEnd).not.toHaveBeenCalled();
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
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);
    const onEnd = vi.fn();

    speak('你好', { onEnd });

    expect(synth.spoken).toHaveLength(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('setTtsEnabled(false) 会把 enabled 写进配置并停掉当前朗读', () => {
    stubLocalStorage();
    const synth = stubSynth([{ lang: 'zh-CN', name: 'Huihui' }]);

    setTtsEnabled(false);

    expect(getTtsSettings().enabled).toBe(false);
    expect(synth.cancel).toHaveBeenCalled();
  });
});
