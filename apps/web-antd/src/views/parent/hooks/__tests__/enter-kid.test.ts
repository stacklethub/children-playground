import { describe, expect, it } from 'vitest';

import { resolveEnterKidAction } from '../enter-kid';

/**
 * 「进入宝宝端」的三条路径。
 *
 * 这里锁住的是**设备归属不被隐式改变**：点「进入宝宝端」只有在对别的孩子
 * 有副作用时才需要确认，而对当前学习者必须是纯导航（不触碰绑定）。
 */
describe('resolveEnterKidAction', () => {
  it('目标就是当前学习者：纯导航，不再绑定', () => {
    expect(resolveEnterKidAction('c1', 'c1')).toBe('navigate');
  });

  it('设备还没选过学习者：直接绑定', () => {
    expect(resolveEnterKidAction(undefined, 'c1')).toBe('bind');
  });

  it('当前学习者是别的孩子：必须二次确认', () => {
    expect(resolveEnterKidAction('c1', 'c2')).toBe('confirm');
  });

  it('同一对参数永远返回同一结果（无隐藏状态）', () => {
    expect(resolveEnterKidAction('c1', 'c2')).toBe(
      resolveEnterKidAction('c1', 'c2'),
    );
  });
});
