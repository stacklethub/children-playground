import type { KidTabsAccent } from '../kid-tabs-accent';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import { KID_PALETTE } from '#/data/kid-palette';

import { ACCENT_CLASS, KID_TABS_RESTING_FG } from '../kid-tabs-accent';
import KidTabs from '../kid-tabs.vue';

const ITEMS = [
  { label: '认字母', value: 'learn' },
  { label: '考一考', value: 'quiz' },
];

/** 非调色板来源的原生色名；调色板里的色一律从 KID_PALETTE 推导，不抄十六进制。 */
const WHITE = '#ffffff';

/** 大文本门槛（页签是 text-xl / sm:text-2xl + font-black，两档都算大文本） */
const LARGE_TEXT_MIN = 3;
/** 静息态门槛：不得比改造前 `text-slate-500` on 白底（约 4.76:1）更差 */
const RESTING_MIN = 4.5;

/** 工具类 → 十六进制。键由 KID_PALETTE 反推，调色板一改这里跟着变。 */
const HEX_BY_CLASS: Record<string, string> = { 'text-white': WHITE };
for (const [name, hex] of Object.entries(KID_PALETTE)) {
  const kebab = name.replaceAll(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  HEX_BY_CLASS[`bg-kid-${kebab}`] = hex;
  HEX_BY_CLASS[`text-kid-${kebab}`] = hex;
}

function hexOf(className: string): string {
  const hex = HEX_BY_CLASS[className];
  if (!hex) throw new Error(`没有色值映射：${className}`);
  return hex;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channel = (offset: number) =>
    srgbToLinear(Number.parseInt(hex.slice(offset, offset + 2), 16));
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 对比度：(亮 + 0.05) / (暗 + 0.05) */
function contrast(hexA: string, hexB: string): number {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Partial 表的取值兜底：缺失即测试失败，而不是静默跳过 */
function accentPair(accent: keyof typeof ACCENT_CLASS): KidTabsAccent {
  const pair = ACCENT_CLASS[accent];
  if (!pair) throw new Error(`ACCENT_CLASS 缺少 ${accent}`);
  return pair;
}

describe('kidTabs', () => {
  it('渲染全部选项', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    expect(wrapper.findAll('button')).toHaveLength(2);
    expect(wrapper.text()).toContain('考一考');
  });

  it('点击未选中项时更新 modelValue 并派发 change', async () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    await wrapper.get('button:last-child').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['quiz']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['quiz']);
  });

  it('点击已选中项不派发事件', async () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    await wrapper.get('button:first-child').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('选中项带上主题色类，未选中不带', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'quiz', accent: 'coral' },
    });
    expect(wrapper.get('button:last-child').classes()).toContain(
      'bg-kid-coral',
    );
    expect(wrapper.get('button:first-child').classes()).not.toContain(
      'bg-kid-coral',
    );
  });
});

describe('kidTabs 对比度', () => {
  it('选中态每一对 {底色,文字色} 都达到大文本 3:1', () => {
    // 收集而非首对即断：一次跑完能看出到底哪几对不达标。
    const failures: string[] = [];
    for (const [accent, pair] of Object.entries(ACCENT_CLASS)) {
      if (!pair) {
        failures.push(`${accent}: ACCENT_CLASS 条目缺失`);
        continue;
      }
      const ratio = contrast(hexOf(pair.bg), hexOf(pair.fg));
      if (ratio < LARGE_TEXT_MIN) {
        failures.push(
          `${accent}: ${pair.bg} + ${pair.fg} = ${ratio.toFixed(2)}:1`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it('静息态文字色不低于改造前的 4.5:1', () => {
    // ink-soft 落在纸白上只有 3.35:1，比改造前的 slate-500（约 4.76:1）退步，
    // 所以这里卡 4.5 而不是大文本的 3 —— 静息态是最常看到的一档。
    const ratio = contrast(KID_PALETTE.paper, hexOf(KID_TABS_RESTING_FG));
    expect(ratio).toBeGreaterThanOrEqual(RESTING_MIN);
  });

  it('text-white 与 text-kid-ink 解析到正确的十六进制', () => {
    // 防止「映射写错、却因为取错色值而算出漂亮数字」。
    expect(hexOf('text-white')).toBe(WHITE);
    expect(hexOf('text-kid-ink')).toBe(KID_PALETTE.ink);
    expect(hexOf('bg-kid-ink-soft')).toBe(KID_PALETTE.inkSoft);
  });

  it('页签确实渲染出这两半类名（选中态成对、静息态用暖棕）', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'quiz', accent: 'coral' },
    });
    const selected = wrapper.get('button:last-child');
    const resting = wrapper.get('button:first-child');

    const { bg, fg } = accentPair('coral');
    expect(selected.classes()).toContain(bg);
    expect(selected.classes()).toContain(fg);

    expect(resting.classes()).toContain(KID_TABS_RESTING_FG);
    expect(resting.classes()).not.toContain(bg);
  });

  it('页签保持大文本档位（否则 3:1 门槛不成立）', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    const classes = wrapper.get('button:first-child').classes();
    // 移动端档位 text-xl(20px) + font-black(900)：WCAG 里「粗体 ≥18.66px」即算大文本，
    // 宽屏回到 text-2xl(24px) 同样是大文本。两档都在门槛内，但都不可去掉 ——
    // 一旦掉回正文档，KID_TABS_RESTING_FG / 主题色的对比度就要按 4.5:1 重算。
    expect(classes).toContain('text-xl');
    expect(classes).toContain('sm:text-2xl');
    expect(classes).toContain('font-black');
  });
});
