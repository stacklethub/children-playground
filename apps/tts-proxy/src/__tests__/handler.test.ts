import { describe, expect, it, vi } from 'vitest';

import { type Env, handleRequest } from '../index';

const ENV: Env = {
  ALLOWED_ORIGIN: 'http://localhost:5666',
  AZURE_SPEECH_KEY: 'test-key',
  AZURE_SPEECH_REGION: 'eastasia',
};

const CORS = { 'CF-Origin': 'http://localhost:5666' };

function postJson(body: unknown, origin = 'http://localhost:5666') {
  return new Request('https://tts.example/tts', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Origin: origin },
    method: 'POST',
  });
}

/** 不落盘的假缓存 */
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    async match(key: Request | string) {
      return store.get(String(key))?.clone();
    },
    async put(key: Request | string, response: Response) {
      store.set(String(key), response.clone());
    },
    size: () => store.size,
  };
}

describe('handleRequest', () => {
  it('GET /voices 返回音色列表与 CORS 头', async () => {
    const response = await handleRequest(
      new Request('https://tts.example/voices', { headers: CORS }),
      ENV,
      { cache: null },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5666',
    );
    const voices = await response.json();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);
  });

  it('参数非法时返回 400 且不调用上游', async () => {
    const fetchImpl = vi.fn();
    const response = await handleRequest(
      postJson({ lang: 'zh-CN' }),
      ENV,
      { cache: null, fetchImpl },
    );
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('合成成功时透传音频，并把 key 放进请求头', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    const response = await handleRequest(
      postJson({ lang: 'en-US', text: 'apple', voice: 'en-US-AvaNeural' }),
      ENV,
      { cache: null, fetchImpl },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('test-key');
    expect(init.headers['Content-Type']).toBe('application/ssml+xml');
    expect(String(init.body)).toContain('<voice name="en-US-AvaNeural">');
  });

  it('缓存命中时不再调用上游', async () => {
    const cache = fakeCache();
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    const request = () =>
      postJson({ lang: 'en-US', text: 'apple', voice: 'en-US-AvaNeural' });

    await handleRequest(request(), ENV, { cache, fetchImpl });
    await handleRequest(request(), ENV, { cache, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('语速不同时缓存 key 不同，两次请求都要打到上游', async () => {
    const cache = fakeCache();
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    const request = (rate: number) =>
      postJson({ lang: 'en-US', rate, text: 'apple', voice: 'en-US-AvaNeural' });

    await handleRequest(request(1), ENV, { cache, fetchImpl });
    await handleRequest(request(1.2), ENV, { cache, fetchImpl });

    // 只按 text 建 key 的话第二次会命中缓存，这里就只剩 1 次
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('上游失败时返回 502，且响应体里不含 key', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const response = await handleRequest(
      postJson({ lang: 'zh-CN', text: '你好', voice: 'zh-CN-XiaoxiaoNeural' }),
      ENV,
      { cache: null, fetchImpl },
    );
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).not.toContain('test-key');
  });

  it('未指定音色时按语言补默认音色', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1]), {
        headers: { 'Content-Type': 'audio/mpeg' },
        status: 200,
      }),
    );
    await handleRequest(
      postJson({ lang: 'zh-CN', text: '你好' }),
      ENV,
      { cache: null, fetchImpl },
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(String(init.body)).toContain('zh-CN-XiaoxiaoNeural');
  });
});
