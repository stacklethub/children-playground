import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// store/kid.ts 会在导入时拉取 #/api；这里只关心集合语义，故整体替换。
vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { useCollection } from '#/data/use-collection';

interface Item {
  id: string;
  name: string;
}

const DEFAULTS: Item[] = [
  { id: 'a1', name: '大象' },
  { id: 'a2', name: '兔子' },
];

function setup() {
  return useCollection<Item>({ defaults: DEFAULTS, key: 'cards' });
}

/** 通用集合：内置内容 + 家长覆盖项的合并、增改删 */
describe('useCollection', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('无覆盖项时返回内置内容', () => {
    expect(setup().items.value).toEqual(DEFAULTS);
  });

  it('可修改内置项', () => {
    const { items, update } = setup();
    update('a1', { name: '小象' });
    expect(items.value).toEqual([
      { id: 'a1', name: '小象' },
      { id: 'a2', name: '兔子' },
    ]);
  });

  it('可删除内置项，其余项与顺序不受影响', () => {
    const { items, remove } = setup();
    remove('a1');
    expect(items.value).toEqual([{ id: 'a2', name: '兔子' }]);
  });

  it('可新增自定义项并追加在末尾', () => {
    const { add, items } = setup();
    add({ name: '长颈鹿' });
    expect(items.value).toHaveLength(3);
    expect(items.value[2]?.name).toBe('长颈鹿');
    expect(items.value[2]?.id).toMatch(/^custom-/);
  });

  it('连续新增时 id 不重复', () => {
    const { add, items } = setup();
    add({ name: 'A' });
    add({ name: 'B' });
    const ids = items.value.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('删除自定义项后彻底移除，不留空壳', () => {
    const { add, items, remove } = setup();
    add({ name: '长颈鹿' });
    const id = items.value[2]!.id;
    remove(id);
    expect(items.value).toEqual(DEFAULTS);
  });

  it('修改内置项后再删除，删除生效', () => {
    const { items, remove, update } = setup();
    update('a1', { name: '小象' });
    remove('a1');
    expect(items.value).toEqual([{ id: 'a2', name: '兔子' }]);
  });

  it('不同模块的覆盖项彼此隔离', () => {
    const cards = useCollection<Item>({ defaults: DEFAULTS, key: 'cards' });
    const letters = useCollection<Item>({ defaults: DEFAULTS, key: 'letters' });
    cards.remove('a1');
    expect(cards.items.value).toHaveLength(1);
    expect(letters.items.value).toHaveLength(2);
  });
});
