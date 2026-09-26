import { describe, expect, it } from 'vitest';

import { MODULE_KEYS, MODULES, TILE_KEYS } from '#/data/modules';

/**
 * 注册表不变量：新增模块时这些断言保证注册信息完整，
 * 避免首页磁贴 / 家长端表单出现空白项。
 */
describe('模块注册表', () => {
  it('每个磁贴 key 都有对应配置且 key 自洽', () => {
    for (const key of TILE_KEYS) {
      expect(MODULES[key]).toBeDefined();
      expect(MODULES[key].key).toBe(key);
    }
  });

  it('每个磁贴都有首页展示所需的 emoji / bg / path', () => {
    for (const key of TILE_KEYS) {
      const def = MODULES[key];
      expect(def.emoji).toBeTruthy();
      expect(def.bg).toMatch(/^bg-/);
      expect(def.path).toMatch(/^\/kid\//);
    }
  });

  it('可学习模块都有正整数每日目标', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULES[key].defaultGoal).toBeGreaterThan(0);
    }
  });

  it('内容型模块都声明了表单字段', () => {
    for (const key of TILE_KEYS) {
      if (MODULES[key].kind !== 'content') continue;
      expect(MODULES[key].fields?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('参数型模块都声明了难度区间且默认值落在区间内', () => {
    for (const key of TILE_KEYS) {
      const def = MODULES[key];
      if (def.kind !== 'param') continue;
      expect(def.range).toBeDefined();
      const { default: fallback, max, min } = def.range!;
      expect(fallback).toBeGreaterThanOrEqual(min);
      expect(fallback).toBeLessThanOrEqual(max);
    }
  });

  it('非学习入口不参与每日目标', () => {
    for (const key of TILE_KEYS) {
      if ((MODULE_KEYS as readonly string[]).includes(key)) continue;
      expect(MODULES[key].defaultGoal).toBe(0);
    }
  });
});
