import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { MODULES } from '#/data/modules';
import { useKidStore } from '#/store';

/** 新增模块不会因为 dailyGoals 缺 key 而算出 undefined */
describe('每日目标回落', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('未配置时回落到注册表默认目标', () => {
    const kid = useKidStore();
    expect(kid.goalOf('cards')).toBe(MODULES.cards.defaultGoal);
    expect(kid.goalOf('letters')).toBe(MODULES.letters.defaultGoal);
    expect(kid.goalOf('numbers')).toBe(MODULES.numbers.defaultGoal);
    expect(kid.goalOf('songs')).toBe(MODULES.songs.defaultGoal);
  });

  it('家长配置后优先使用配置值，未配置的模块仍回落', () => {
    const kid = useKidStore();
    kid.dailyGoals = { cards: 3 };
    expect(kid.goalOf('cards')).toBe(3);
    expect(kid.goalOf('letters')).toBe(MODULES.letters.defaultGoal);
  });

  it('目标值始终为正整数，不会因缺 key 变成 undefined', () => {
    const kid = useKidStore();
    kid.dailyGoals = {};
    for (const module of ['cards', 'letters', 'numbers', 'songs'] as const) {
      const goal = kid.goalOf(module);
      expect(Number.isInteger(goal)).toBe(true);
      expect(goal).toBeGreaterThan(0);
    }
  });
});
