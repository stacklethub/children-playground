import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { MODULES } from '#/data/modules';
import { useKidStore } from '#/store';

/** 参数型模块：默认启用、难度取注册表默认值，家长配置后以配置为准 */
describe('模块设置', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('未配置时默认启用', () => {
    const kid = useKidStore();
    expect(kid.moduleEnabled('cards')).toBe(true);
    expect(kid.moduleEnabled('letters')).toBe(true);
  });

  it('显式关闭后不再启用', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { enabled: false } };
    expect(kid.moduleEnabled('letters')).toBe(false);
    expect(kid.moduleEnabled('cards')).toBe(true);
  });

  it('难度范围未配置时回落到注册表默认值', () => {
    const kid = useKidStore();
    expect(kid.moduleRange('letters')).toBe(MODULES.letters.range!.default);
    expect(kid.moduleRange('numbers')).toBe(MODULES.numbers.range!.default);
  });

  it('家长配置后以配置为准', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { range: 8 } };
    expect(kid.moduleRange('letters')).toBe(8);
    expect(kid.moduleRange('numbers')).toBe(MODULES.numbers.range!.default);
  });

  it('无难度区间的模块返回 Infinity（不限制）', () => {
    const kid = useKidStore();
    expect(kid.moduleRange('cards')).toBe(Number.POSITIVE_INFINITY);
  });

  it('开关与范围可独立配置', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { range: 8 } };
    expect(kid.moduleEnabled('letters')).toBe(true);
    expect(kid.moduleRange('letters')).toBe(8);
  });
});
