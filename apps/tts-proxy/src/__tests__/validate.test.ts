import { describe, expect, it } from 'vitest';

import { MAX_TEXT_LENGTH, parseSynthRequest } from '../validate';

describe('parseSynthRequest', () => {
  it('接受合法请求并回落可选字段的默认值', () => {
    const result = parseSynthRequest({
      lang: 'zh-CN',
      text: '点一点字母',
      voice: 'zh-CN-XiaoxiaoNeural',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rate).toBe(0.9);
    expect(result.value.pitch).toBe(0);
  });

  it('缺 text 时报错', () => {
    expect(parseSynthRequest({ lang: 'zh-CN' }).ok).toBe(false);
  });

  it('空文本报错', () => {
    expect(parseSynthRequest({ lang: 'zh-CN', text: '   ' }).ok).toBe(false);
  });

  it('超长文本报错（防止被当作免费 TTS 代理刷额度）', () => {
    const long = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    expect(parseSynthRequest({ lang: 'en-US', text: long }).ok).toBe(false);
  });

  it('非法 lang 报错', () => {
    expect(parseSynthRequest({ lang: 'ja-JP', text: 'hi' }).ok).toBe(false);
  });

  it('音色不在白名单时报错', () => {
    const result = parseSynthRequest({
      lang: 'en-US',
      text: 'hi',
      voice: 'en-US-NotARealVoice',
    });
    expect(result.ok).toBe(false);
  });

  it('音色与语言不匹配时报错', () => {
    const result = parseSynthRequest({
      lang: 'zh-CN',
      text: '你好',
      voice: 'en-US-AvaNeural',
    });
    expect(result.ok).toBe(false);
  });

  it('语速与音调超出范围时被夹取而非报错', () => {
    const result = parseSynthRequest({
      lang: 'en-US',
      pitch: 999,
      rate: 9,
      text: 'hi',
      voice: 'en-US-AvaNeural',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rate).toBe(1.5);
    expect(result.value.pitch).toBe(50);
  });
});
