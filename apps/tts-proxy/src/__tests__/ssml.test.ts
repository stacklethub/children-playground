import { describe, expect, it } from 'vitest';

import { buildSsml, pitchToProsody, rateToProsody } from '../ssml';

describe('rateToProsody', () => {
  it('把倍率转成 Azure 的相对百分比', () => {
    expect(rateToProsody(0.9)).toBe('-10%');
    expect(rateToProsody(1)).toBe('+0%');
    expect(rateToProsody(1.25)).toBe('+25%');
  });
});

describe('pitchToProsody', () => {
  it('保留正负号', () => {
    expect(pitchToProsody(0)).toBe('+0%');
    expect(pitchToProsody(-20)).toBe('-20%');
    expect(pitchToProsody(15)).toBe('+15%');
  });
});

describe('buildSsml', () => {
  it('带音色、语速、音调与语言', () => {
    const ssml = buildSsml({
      lang: 'en-US',
      pitch: 10,
      rate: 0.9,
      text: 'apple',
      voice: 'en-US-AvaNeural',
    });
    expect(ssml).toContain('xml:lang="en-US"');
    expect(ssml).toContain('<voice name="en-US-AvaNeural">');
    expect(ssml).toContain('rate="-10%"');
    expect(ssml).toContain('pitch="+10%"');
    expect(ssml).toContain('>apple<');
  });

  it('转义 XML 特殊字符，中文标点原样保留', () => {
    const ssml = buildSsml({
      lang: 'zh-CN',
      pitch: 0,
      rate: 1,
      text: '猫 & 狗 <玩> "球" ！',
      voice: 'zh-CN-XiaoxiaoNeural',
    });
    expect(ssml).toContain('&amp;');
    expect(ssml).toContain('&lt;');
    expect(ssml).toContain('&gt;');
    expect(ssml).toContain('&quot;');
    expect(ssml).toContain('！');
    expect(ssml).not.toContain('<玩>');
  });
});
