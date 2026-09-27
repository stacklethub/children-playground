import { describe, expect, it } from 'vitest';

import { emojiAvatar } from '../avatar';

/**
 * `emojiAvatar` 存在的唯一理由：vben 的 VbenAvatar 把 avatar 当 `<img src>` 用，
 * 直接传 emoji 会加载失败并退化为渲染 alt 文本（= 昵称），造成「家长 家长」重影。
 * 所以这里锁住「产出的必须是一个自包含的图片 URL」。
 */
describe('emojiAvatar', () => {
  it('产出 data URI 形式的 SVG 图片', () => {
    const url = emojiAvatar('🧑');

    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(url)).toContain('<svg');
  });

  it('保留传入的 emoji（解码后仍在 SVG 文本里）', () => {
    expect(decodeURIComponent(emojiAvatar('🧑'))).toContain('🧑');
  });

  it('内容整体百分号编码，可安全直接放进 src 属性', () => {
    const url = emojiAvatar('🧑');

    // 原始尖括号/双引号必须已编码，否则属性或 DOM 会被破坏
    expect(url).not.toContain('<');
    expect(url).not.toContain('"');
  });

  it('不自引用任何外部图片', () => {
    // 说明：SVG 里的 xmlns="http://www.w3.org/2000/svg" 只是命名空间声明，
    // 不产生网络请求，所以这里查的是真正的资源引用。
    const svg = decodeURIComponent(emojiAvatar('🧑'));

    expect(svg).not.toContain('href');
    expect(svg).not.toContain('url(');
    expect(svg).not.toContain('<image');
  });
});
