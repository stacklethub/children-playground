import type { LearnModule } from '#/data/modules';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { MODULES } from '#/data/modules';
import { useKidStore } from '#/store';

/** 注册表声明的难度区间默认值；只对声明了区间的模块调用 */
function rangeDefault(module: LearnModule): number {
  const range = MODULES[module].range;
  if (!range) throw new Error(`${module} 未声明难度区间`);
  return range.default;
}

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
    expect(kid.moduleRange('letters')).toBe(rangeDefault('letters'));
    expect(kid.moduleRange('numbers')).toBe(rangeDefault('numbers'));
  });

  it('家长配置后以配置为准', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { range: 8 } };
    expect(kid.moduleRange('letters')).toBe(8);
    expect(kid.moduleRange('numbers')).toBe(rangeDefault('numbers'));
  });

  it('条目顺序未配置时按内容顺序', () => {
    const kid = useKidStore();
    expect(kid.moduleOrder('letters')).toBe('seq');
  });

  it('条目顺序配置后以配置为准，不影响其他模块', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { order: 'random' } };
    expect(kid.moduleOrder('letters')).toBe('random');
    expect(kid.moduleOrder('numbers')).toBe('seq');
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
