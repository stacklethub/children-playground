import { describe, expect, it } from 'vitest';

import { MODULE_KEYS, MODULES, TILE_KEYS } from '#/data/modules';

/**
 * 首页磁贴基准快照：改造前（registry 化之前）的硬编码值。
 *
 * 上面的不变量只校验「形状」合法，改错具体数值仍会通过；
 * 而 Global Constraint 要求宝宝端 5 个模块行为零回退，
 * 因此这里把 emoji / 底色 / 路由 / 每日目标逐项钉死。
 * 顺序即首页渲染顺序，同样需要保持一致。
 */
const TILE_SNAPSHOT = [
  { bg: 'bg-orange-400', defaultGoal: 10, emoji: '🐘', key: 'cards', path: '/kid/cards' },
  { bg: 'bg-sky-400', defaultGoal: 6, emoji: '🔤', key: 'letters', path: '/kid/letters' },
  { bg: 'bg-rose-400', defaultGoal: 6, emoji: '🅰️', key: 'pinyin', path: '/kid/pinyin' },
  { bg: 'bg-lime-500', defaultGoal: 1, emoji: '📜', key: 'poems', path: '/kid/poems' },
  { bg: 'bg-cyan-500', defaultGoal: 4, emoji: '🧩', key: 'logic', path: '/kid/logic' },
  { bg: 'bg-fuchsia-500', defaultGoal: 1, emoji: '🗺️', key: 'adventure', path: '/kid/adventure' },
  { bg: 'bg-emerald-400', defaultGoal: 6, emoji: '🔢', key: 'numbers', path: '/kid/numbers' },
  { bg: 'bg-violet-400', defaultGoal: 2, emoji: '🎵', key: 'songs', path: '/kid/songs' },
  { bg: 'bg-amber-400', defaultGoal: 0, emoji: '⭐', key: 'rewards', path: '/kid/rewards' },
] as const;

/**
 * 注册表不变量：新增模块时这些断言保证注册信息完整，
 * 避免首页磁贴 / 家长端表单出现空白项。
 */
describe('模块注册表', () => {
  it('5 个磁贴的 emoji / 底色 / 路由 / 每日目标与改造前逐项一致', () => {
    expect(TILE_KEYS).toEqual(TILE_SNAPSHOT.map((tile) => tile.key));

    for (const expected of TILE_SNAPSHOT) {
      const def = MODULES[expected.key];
      expect(def.emoji).toBe(expected.emoji);
      expect(def.bg).toBe(expected.bg);
      expect(def.path).toBe(expected.path);
      expect(def.defaultGoal).toBe(expected.defaultGoal);
    }
  });

  it('每个磁贴 key 都有对应配置且 key 自洽', () => {
    for (const key of TILE_KEYS) {
      expect(MODULES[key]).toBeDefined();
      expect(MODULES[key].key).toBe(key);
    }
  });

  it('每个磁贴都有首页展示所需的 emoji / bg / path / color', () => {
    for (const key of TILE_KEYS) {
      const def = MODULES[key];
      expect(def.emoji).toBeTruthy();
      expect(def.bg).toMatch(/^bg-/);
      expect(def.path).toMatch(/^\/kid\//);
      // 家长端报告页的图表配色也取自注册表
      expect(def.color).toMatch(/^#[0-9A-F]{6}$/i);
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
      const range = def.range;
      expect(range).toBeDefined();
      if (!range) continue;
      expect(range.default).toBeGreaterThanOrEqual(range.min);
      expect(range.default).toBeLessThanOrEqual(range.max);
    }
  });

  it('非学习入口不参与每日目标', () => {
    for (const key of TILE_KEYS) {
      if ((MODULE_KEYS as readonly string[]).includes(key)) continue;
      expect(MODULES[key].defaultGoal).toBe(0);
    }
  });
});
