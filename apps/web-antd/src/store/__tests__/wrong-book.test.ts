import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useKidStore } from '#/store';

/**
 * 错题本：按孩子隔离，答错累加次数，答对移出。
 * 与 pinyin-vue 的「加入错题本 / 记住了移出」闭环对应。
 */
describe('错题本', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('初始为空', () => {
    const kid = useKidStore();
    expect(kid.wrongOf('child-a', 'pinyin' as never)).toEqual([]);
  });

  it('加入错题后可按模块查到', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    const list = kid.wrongOf('child-a', 'cards');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ count: 1, itemId: 'a1', module: 'cards' });
  });

  it('同一题重复答错累加次数而不是新增条目', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'cards', 'a1');
    const list = kid.wrongOf('child-a', 'cards');
    expect(list).toHaveLength(1);
    expect(list[0]?.count).toBe(2);
  });

  it('答对后移出错题本', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.removeWrong('child-a', 'cards', 'a1');
    expect(kid.wrongOf('child-a', 'cards')).toEqual([]);
  });

  it('不同模块的错题互不干扰', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'letters', 'A');
    expect(kid.wrongOf('child-a', 'cards')).toHaveLength(1);
    expect(kid.wrongOf('child-a', 'letters')).toHaveLength(1);
  });

  it('不同孩子的错题彼此隔离', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-b', 'cards', 'a2');
    expect(kid.wrongOf('child-a', 'cards').map((w) => w.itemId)).toEqual([
      'a1',
    ]);
    expect(kid.wrongOf('child-b', 'cards').map((w) => w.itemId)).toEqual([
      'a2',
    ]);
  });

  it('清空可按模块或整体', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'letters', 'A');
    kid.clearWrong('child-a', 'cards');
    expect(kid.wrongOf('child-a', 'cards')).toEqual([]);
    expect(kid.wrongOf('child-a', 'letters')).toHaveLength(1);
    kid.clearWrong('child-a');
    expect(kid.wrongOf('child-a', 'letters')).toEqual([]);
  });

  it('清空本机记录会一并清掉该孩子的错题本与闯关进度，且不影响其他孩子', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-b', 'cards', 'a2');
    kid.clearLevel('child-a', 'lv1');
    kid.clearLevel('child-b', 'lv1');

    kid.clearRecords('child-a');

    expect(kid.wrongOf('child-a', 'cards')).toEqual([]);
    expect(kid.adventureProgress['child-a']).toBeUndefined();
    expect(kid.wrongOf('child-b', 'cards')).toHaveLength(1);
    expect(kid.adventureProgress['child-b']).toEqual(['lv1']);
  });

  it('整体清空错题本时删键而不是留空数组', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.clearWrong('child-a');
    expect(kid.wrongBook['child-a']).toBeUndefined();
  });

  it('最新答错的排在最前', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'cards', 'a2');
    expect(kid.wrongOf('child-a', 'cards').map((w) => w.itemId)).toEqual([
      'a2',
      'a1',
    ]);
  });
});
