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
    // 比较忽略十六进制大小写：oxfmt 会把 CSS 里的颜色统一成小写（pre-commit 钩子
    // 带 stage_fixed，落库的必然是小写形式），而十六进制大小写在 CSS 中语义等价，
    // 不是本测试要锁的契约。要锁的是「令牌名 ↔ 色值」的逐一对应关系。
    const css = themeCss.toLowerCase();
    for (const [name, hex] of Object.entries(KID_PALETTE)) {
      const kebab = name.replaceAll(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(css).toContain(`--color-kid-${kebab}: ${hex.toLowerCase()};`);
    }
  });
});
