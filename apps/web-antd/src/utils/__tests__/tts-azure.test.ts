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

describe('tts-azure', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubEnv('VITE_TTS_PROXY_URL', URL_BASE);
  });

  afterEach(() => {
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
    expect(audio.src).toBe('blob:fake');
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

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('播新的之前先停掉上一段', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    const first = FakeAudio.instances[0]!;

    speakAzure('bear', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });

    expect(first.paused).toBe(true);
    expect(first.src).toBe('');
  });

  it('stopAzure 会停掉当前音频并释放 URL', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { status: 200 })));

    speakAzure('apple', { lang: 'en-US', pitch: 0, rate: 1, voice: '' });
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));

    stopAzure();

    expect(FakeAudio.instances[0]!.paused).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
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
