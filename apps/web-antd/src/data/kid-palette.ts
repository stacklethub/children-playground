import type { TileKey } from './modules';

/**
 * 儿童端调色板 —— **唯一事实源**。
 *
 * 为什么事实源在 TS 而不是 CSS：岛上的场景与 9 个地点图标是内联 SVG，
 * `fill` / `stroke` 属性吃不到 CSS 变量，且 JS 侧还要用色值做派生计算。
 * CSS 令牌（`internal/tailwind-config/src/theme.css`）由
 * `__tests__/kid-palette.test.ts` 守住与本文件一致。
 *
 * 选色原则：描边用暖棕而非纯黑（整屏不「硬」），底色走奶油纸感而非纯白，
 * 强调色低饱和 —— 3-5 岁幼儿长时间注视，高饱和撞色容易疲劳。
 *
 * 十六进制统一小写：与落库 CSS 逐字一致（oxfmt 会把 CSS 颜色降为小写），
 * 这样测试可以大小写敏感地比对，属性名的大小写错误也能被抓住。
 * SVG 的 `fill` / `stroke` 对大小写不敏感，组件侧不受影响。
 */
export const KID_PALETTE = {
  ink: '#4a3f35',
  inkSoft: '#9a8877',
  paper: '#fffdf7',
  cream: '#f5e3c6',
  coral: '#e8756b',
  apricot: '#f0a868',
  sun: '#ffd98e',
  leaf: '#8fc98a',
  leafDark: '#7fb87c',
  sky: '#5b8db8',
  blush: '#e8a0b4',
  lilac: '#d5cfea',
  sea: '#6bbbd8',
  berry: '#b98a5e',
  gold: '#ffb100',
} as const;

export type KidColorName = keyof typeof KID_PALETTE;

/** 模块入口 → 主题色。9 个入口全覆盖（含非学习入口 rewards）。 */
export const KID_MODULE_COLOR: Record<TileKey, KidColorName> = {
  cards: 'apricot',
  letters: 'sky',
  pinyin: 'coral',
  poems: 'leaf',
  logic: 'sun',
  adventure: 'berry',
  numbers: 'lilac',
  songs: 'blush',
  rewards: 'gold',
};
