import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAzureVoices, isAzureConfigured, speakAzure, stopAzure } from '#/utils/tts-azure';

class FakeAudio {
  static instances: FakeAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = true;
  playbackRate = 1;
  src: string;
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  load() {}
  pause() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
}

const URL_BASE = 'https://tts.example';

/** 每次返回不同的 blob URL，方便断言「撤销的是哪一段」 */
let urlSequence = 0;

function okResponse() {
  const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
  return new Response(blob, { status: 200 });
}

/**
 * 可控的 fetch：请求全部挂起，由测试决定谁先返回、返回什么。
 * 用来复现「先发起的那次晚返回」这种连点场景。
 */
function stubPendingFetch() {
  const pending: {
    reject: (error: unknown) => void;
    resolve: (response: Response) => void;
  }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve, reject) => {
          pending.push({ reject, resolve });
        }),
    ),
  );
  return pending;
}

describe('tts-azure', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    urlSequence = 0;
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:fake:${(urlSequence += 1)}`),
      revokeObjectURL: vi.fn(),
    });
    vi.stubEnv('VITE_TTS_PROXY_URL', URL_BASE);
  });

  afterEach(() => {
    // 先把还在播的那段收掉：模块级的 current 会活到下一条用例里，
    // 它被下一条用例的 stopAzure 顺手撤销，污染「撤销的是哪一段」的断言
    stopAzure();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('配置了代理地址时视为已配置', () => {
    expect(isAzureConfigured()).toBe(true);
  });

  it('未配置代理地址时视为不可用', () => {
    vi.stubEnv('VITE_TTS_PROXY_URL', '');
    expect(isAzureConfigured()).toBe(false);
  });

  it('合成成功后用 fetch 返回的音频创建并播放', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));

    speakAzure('apple', {
      lang: 'en-US',
      pitch: 0,
      rate: 0.9,
      voice: 'en-US-AvaNeural',
    });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    const audio = FakeAudio.instances[0]!;
    expect(audio.src).toBe('blob:fake:1');
    expect(audio.playbackRate).toBeCloseTo(0.9);
    expect(audio.paused).toBe(false);

    const [calledUrl, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(calledUrl).toBe(`${URL_BASE}/tts`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).voice).toBe('en-US-AvaNeural');
  });

  it('请求失败时回调 onEnd，不抛错（交给上层降级）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 502 })));
    const onEnd = vi.fn();

    expect(() =>
      speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 0.9, voice: '', onEnd }),
    ).not.toThrow();
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it('网络异常时回调 onEnd', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const onEnd = vi.fn();

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 0.9, voice: '', onEnd });
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
  });

  it('播放结束后释放 blob URL 并回调 onEnd（只调一次）', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));
    const onEnd = vi.fn();

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 0.9, voice: '', onEnd });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    const audio = FakeAudio.instances[0]!;
    audio.onended?.();
    audio.onended?.();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake:1');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('连点时先停掉并释放上一段，同一时刻只有一段在放', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()));

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const first = FakeAudio.instances[0]!;
    const firstUrl = first.src;

    speakAzure('bear', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2));

    expect(first.paused).toBe(true);
    expect(first.src).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    expect(FakeAudio.instances.filter((audio) => !audio.paused)).toHaveLength(1);
    expect(FakeAudio.instances[1]!.paused).toBe(false);
  });

  it('先发起的那次晚返回时不播放，也不碰后发起那段的音频（F3）', async () => {
    const pending = stubPendingFetch();
    const onEndA = vi.fn();
    const onErrorA = vi.fn();

    speakAzure('apple', {
      lang: 'en-US',
      onEnd: onEndA,
      onError: onErrorA,
      pitch: 0,
      rate: 1,
      voice: '',
    });
    speakAzure('bear', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });

    // 后发起的 B 先返回并开始播放
    pending[1]!.resolve(okResponse());
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const playing = FakeAudio.instances[0]!;
    const playingUrl = playing.src;

    // A 迟到的响应不能插进来，更不能撤销正在放的那段的 blob URL
    pending[0]!.resolve(okResponse());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(FakeAudio.instances).toHaveLength(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(playing.paused).toBe(false);
    expect(playing.src).toBe(playingUrl);
    // 被取代的那次连收尾回调都不该发（F6）
    expect(onEndA).not.toHaveBeenCalled();
    expect(onErrorA).not.toHaveBeenCalled();
  });

  it('迟到请求的失败不会拆掉后发起那段的音频（F3）', async () => {
    const pending = stubPendingFetch();
    const onErrorA = vi.fn();

    speakAzure('apple', {
      lang: 'en-US',
      onError: onErrorA,
      pitch: 0,
      rate: 1,
      voice: '',
    });
    speakAzure('bear', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });

    pending[1]!.resolve(okResponse());
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const playing = FakeAudio.instances[0]!;

    pending[0]!.reject(new Error('offline'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onErrorA).not.toHaveBeenCalled();
    expect(playing.paused).toBe(false);
    expect(playing.src).not.toBe('');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('stopAzure 会停掉当前音频并释放 URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()));

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    stopAzure();

    expect(FakeAudio.instances[0]!.paused).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake:1');
  });

  it('音色列表请求失败时抛出，交由设置页降级展示', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 500 })));
    await expect(fetchAzureVoices()).rejects.toThrow();
  });

  it('音色列表从 /voices 拉取', async () => {
    const voices = [{ id: 'en-US-AvaNeural', lang: 'en-US', name: 'Ava' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(voices), { status: 200 })),
    );
    await expect(fetchAzureVoices()).resolves.toEqual(voices);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      `${URL_BASE}/voices`,
    );
  });
});
