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
 */
export const KID_PALETTE = {
  ink: '#4A3F35',
  inkSoft: '#9A8877',
  paper: '#FFFDF7',
  cream: '#F5E3C6',
  coral: '#E8756B',
  apricot: '#F0A868',
  sun: '#FFD98E',
  leaf: '#8FC98A',
  leafDark: '#7FB87C',
  sky: '#5B8DB8',
  blush: '#E8A0B4',
  lilac: '#D5CFEA',
  sea: '#6BBBD8',
  berry: '#B98A5E',
  gold: '#FFB100',
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
