import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { KID_MODULE_COLOR, KID_PALETTE } from '../kid-palette';
import { TILE_KEYS } from '../modules';

/**
 * Tailwind 的 kid 设计令牌写在共享主题文件里，而色值的**事实源**是
 * 本目录的 kid-palette.ts（内联 SVG 的 fill 需要真实色值，拿不到 CSS 变量）。
 * 两份数据天然会漂移，这个测试就是防漂移的锁。
 *
 * 用 `import.meta.dirname` 而非 `import.meta.url` 解析：happy-dom 会替换全局
 * `URL`，其实现不认 `file:` base，会把相对路径解析成 document origin 下的
 * `http://localhost:3000/...`，`fileURLToPath` 随即抛 scheme 错误。
 */
const themeCss = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../../internal/tailwind-config/src/theme.css',
  ),
  'utf8',
);

describe('kidPalette', () => {
  it('9 个入口全部有主题色，不多不少', () => {
    expect(Object.keys(KID_MODULE_COLOR).toSorted()).toEqual(
      [...TILE_KEYS].toSorted(),
    );
  });

  it('每个主题色都指向调色板里真实存在的颜色', () => {
    for (const name of Object.values(KID_MODULE_COLOR)) {
      expect(KID_PALETTE[name]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('css 令牌与调色板逐一对应', () => {
    // 大小写敏感：CSS 自定义属性名大小写敏感（`--color-kid-Ink` 不会生成
    // `bg-kid-ink`），因此调色板与主题文件都统一用小写十六进制，逐字比对。
    for (const [name, hex] of Object.entries(KID_PALETTE)) {
      const kebab = name.replaceAll(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(themeCss).toContain(`--color-kid-${kebab}: ${hex};`);
    }
  });

  it('非颜色令牌与主题文件逐一对应', () => {
    // 这些令牌同样承诺了工具类（rounded-kid-card / shadow-kid-hard / ease-kid-pop），
    // 拼错一个字母工具类就会静默消失，所以和色值一样需要锁住。
    // 值带 `;` 结尾，避免 `--shadow-kid-hard` 被相近前缀误命中。
    const tokens: [string, string][] = [
      ['--radius-kid-card', '26px'],
      ['--radius-kid-pill', '999px'],
      ['--shadow-kid-hard', '4px 4px 0 var(--color-kid-ink)'],
      ['--shadow-kid-soft', '0 10px 30px rgb(74 63 53 / 14%)'],
      ['--ease-kid-pop', 'cubic-bezier(0.34, 1.56, 0.64, 1)'],
    ];
    for (const [name, value] of tokens) {
      expect(themeCss).toContain(`${name}: ${value};`);
    }
  });
});
