import type { KidColorName } from '#/data/kid-palette';

/**
 * KidTabs 的选中态配色表，单独成模块是为了让 `kid-tabs.test.ts` 能直接读到
 * 这张表本身 —— 把十六进制抄进测试就失去了防漂移的意义。
 *
 * 类名依然是源码里的字面量，Tailwind 扫描得到（动态拼 `bg-kid-${accent}`
 * 才会漏扫）。
 */
export interface KidTabsAccent {
  /** 选中态底色工具类 */
  bg: string;
  /** 选中态文字色工具类 */
  fg: string;
}

/**
 * 静息（未选中）态的文字色。页签自身是 `bg-transparent`，透出的是容器上的
 * `bg-kid-paper`，所以对比度按 `KID_PALETTE.paper` 计算。
 *
 * 用暖棕而非 ink-soft：ink-soft 落在纸白上只有 3.35:1，比改造前
 * `text-slate-500` on 白底（约 4.76:1）明显退步。要求 ≥4.5:1 是为了把
 * 「不得比改造前更差」这条线钉住。
 */
export const KID_TABS_RESTING_FG = 'text-kid-ink';

/**
 * 选中态必须是成对的 `{ 底色, 文字色 }`，**不能统一用一个文字色**。
 *
 * 页签是 `text-2xl`(24px) + `font-black`，属 WCAG「大文本」，门槛 3:1。
 * 逐色算过之后只有 sky 配得起白字：
 *
 * - sky `#5b8db8`：白字 3.53:1 ✓，暖棕 `#4a3f35` 只有 2.90:1 ✗
 *   —— 统一改暖棕会让 letters 页反而跌破 3:1，所以不能一刀切。
 * - 其余 8 色配暖棕在 3.34 ~ 7.58:1 之间；它们配白字只有 1.3 ~ 2.0:1，
 *   基本看不清（lilac / sun 尤其糟）。
 *
 * 具体数值由 `kid-tabs.test.ts` 逐对断言，改色前先跑那张表。
 */
export const ACCENT_CLASS: Partial<Record<KidColorName, KidTabsAccent>> = {
  apricot: { bg: 'bg-kid-apricot', fg: 'text-kid-ink' },
  berry: { bg: 'bg-kid-berry', fg: 'text-kid-ink' },
  blush: { bg: 'bg-kid-blush', fg: 'text-kid-ink' },
  coral: { bg: 'bg-kid-coral', fg: 'text-kid-ink' },
  gold: { bg: 'bg-kid-gold', fg: 'text-kid-ink' },
  leaf: { bg: 'bg-kid-leaf', fg: 'text-kid-ink' },
  lilac: { bg: 'bg-kid-lilac', fg: 'text-kid-ink' },
  sky: { bg: 'bg-kid-sky', fg: 'text-white' },
  sun: { bg: 'bg-kid-sun', fg: 'text-kid-ink' },
};
