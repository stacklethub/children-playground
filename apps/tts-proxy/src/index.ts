/**
 * 语音代理 Worker。
 *
 * 存在的唯一理由：Azure 的订阅 key 不能放前端。前端 -> 本 worker -> Azure。
 * 顺带做缓存：引导语/表扬语高度重复，缓存命中能显著降低 Azure 额度消耗。
 */

import { buildSsml, type SynthRequest } from './ssml';
import { parseSynthRequest } from './validate';
import { type TtsLang, VOICES } from './voices';

export interface Env {
  ALLOWED_ORIGIN: string;
  AZURE_SPEECH_KEY: string;
  AZURE_SPEECH_REGION: string;
}

export interface CacheLike {
  match(key: Request | string): Promise<Response | undefined>;
  put(key: Request | string, response: Response): Promise<void>;
}

export interface Deps {
  cache?: CacheLike | null;
  fetchImpl?: typeof fetch;
}

const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const AZURE_TIMEOUT_MS = 15_000;
/** 合成结果的 HTTP 缓存时长（30 天）。引导语高度重复，缓存命中能省下 Azure 额度 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
  };
}

function jsonResponse(data: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
    status,
  });
}

/** 未指定音色时取该语言的第一个 */
export function defaultVoiceId(lang: TtsLang): string {
  return VOICES.find((voice) => voice.lang === lang)?.id ?? '';
}

async function buildCacheKey(voice: string, request: SynthRequest): Promise<string> {
  const payload = [
    request.text,
    request.lang,
    voice,
    String(request.rate),
    String(request.pitch),
  ].join('|');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload),
  );
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `https://tts-cache.invalid/${hash}`;
}

async function synthesize(
  voice: string,
  request: SynthRequest,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const url = `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetchImpl(url, {
    body: buildSsml({ ...request, voice }),
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
    },
    method: 'POST',
    signal: AbortSignal.timeout(AZURE_TIMEOUT_MS),
  });
  return response;
}

export async function handleRequest(
  request: Request,
  env: Env,
  deps: Deps = {},
): Promise<Response> {
  const { cache = null, fetchImpl = fetch } = deps;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(env), status: 204 });
  }

  if (request.method === 'GET' && url.pathname === '/voices') {
    return jsonResponse(VOICES, 200, env);
  }

  if (request.method !== 'POST' || url.pathname !== '/tts') {
    return jsonResponse({ error: 'Not Found' }, 404, env);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: '请求体不是合法 JSON' }, 400, env);
  }

  const parsed = parseSynthRequest(raw);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400, env);

  const voice = parsed.value.voice || defaultVoiceId(parsed.value.lang);
  const cacheKey = await buildCacheKey(voice, parsed.value);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  let upstream: Response;
  try {
    upstream = await synthesize(voice, parsed.value, env, fetchImpl);
  } catch {
    return jsonResponse({ error: '语音服务暂时不可用' }, 502, env);
  }

  if (!upstream.ok) {
    // 不要透传上游响应体，避免任何形式的凭据泄露
    return jsonResponse({ error: '语音服务暂时不可用' }, 502, env);
  }

  const audio = new Response(upstream.body, {
    headers: {
      ...corsHeaders(env),
      'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`,
      'Content-Type': 'audio/mpeg',
    },
    status: 200,
  });

  if (cache) {
    try {
      await cache.put(cacheKey, audio.clone());
    } catch {
      // 缓存写入失败不影响本次返回
    }
  }

  return audio;
}

export default {
  fetch(request: Request, env: Env) {
    // 测试环境没有 Cloudflare 的 caches，此时退化为不走缓存
    const cache =
      typeof caches === 'undefined'
        ? null
        : (caches as unknown as { default: CacheLike }).default;
    return handleRequest(request, env, { cache });
  },
};
