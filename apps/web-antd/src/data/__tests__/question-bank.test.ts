import { describe, expect, it } from 'vitest';

import { buildLabelIndex, resolveItemLabel } from '../question-bank';

describe('题目标签反查（学习记录只存 itemId，展示时反查）', () => {
  const index = buildLabelIndex({});

  it('cards 按 id 反查卡片名', () => {
    // 内置第一个动物卡是「大象」id=a1
    expect(resolveItemLabel('cards', 'a1', index)).toBe('大象');
  });

  it('pinyin 按 id 反查汉字', () => {
    // pinyin 条目 id 形如 p-xx，认汉字条目 hanzi 有值
    const label = resolveItemLabel('pinyin', 'p-a', index);
    expect(typeof label).toBe('string');
    expect(String(label).length).toBeGreaterThan(0);
  });

  it('poems 按 id 反查诗名', () => {
    expect(resolveItemLabel('poems', 'poem-jingyesi', index)).toBe('静夜思');
  });

  it('letters 按字母反查单词', () => {
    expect(resolveItemLabel('letters', 'A', index)).toBe('apple');
  });

  it('numbers 按 num 反查数字汉字', () => {
    // KidNumber num=1 → word 应是一
    expect(resolveItemLabel('numbers', '1', index)).toBeTruthy();
  });

  it('查不到返回 undefined（如 letters 认单词的 w- 前缀临时 id）', () => {
    expect(resolveItemLabel('letters', 'w-A', index)).toBeUndefined();
  });

  it('数字王国算一算的表达式临时 id 查不到', () => {
    expect(resolveItemLabel('numbers', '1 + 2', index)).toBeUndefined();
  });
});
