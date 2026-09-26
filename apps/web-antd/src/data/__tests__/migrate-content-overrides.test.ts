import { describe, expect, it } from 'vitest';

import { migrateContentOverrides } from '#/data/migrate-content-overrides';

/**
 * 回归测试：contentOverrides 曾是「卡片 id → patch」的扁平结构，
 * 多模块改造后变为「模块 key → 卡片 id → patch」。
 * 迁移必须保证已存在用户的自定义卡片不丢失。
 */
describe('contentOverrides 结构迁移', () => {
  it('把旧的扁平结构整体搬入 cards', () => {
    const legacy = {
      a1: { name: '大象改' },
      'custom-abc': { added: true, name: '长颈鹿' },
    };
    expect(migrateContentOverrides(legacy)).toEqual({ cards: legacy });
  });

  it('已是新结构时原样返回', () => {
    const current = { cards: { a1: { name: '大象改' } } };
    expect(migrateContentOverrides(current)).toEqual(current);
  });

  it('新结构里的其他模块 key 不会被误判为旧结构', () => {
    const current = { cards: {}, songs: {} };
    expect(migrateContentOverrides(current)).toEqual(current);
  });

  it('空对象返回空对象', () => {
    expect(migrateContentOverrides({})).toEqual({});
  });

  it('非对象输入返回空对象，不抛错', () => {
    expect(migrateContentOverrides(null)).toEqual({});
    expect(migrateContentOverrides(undefined)).toEqual({});
    expect(migrateContentOverrides('x')).toEqual({});
    expect(migrateContentOverrides([])).toEqual({});
    expect(migrateContentOverrides(0)).toEqual({});
  });

  it('迁移是幂等的', () => {
    const once = migrateContentOverrides({ a1: { name: '大象' } });
    expect(migrateContentOverrides(once)).toEqual(once);
  });
});
