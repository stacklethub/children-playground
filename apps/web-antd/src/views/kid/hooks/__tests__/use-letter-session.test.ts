import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useKidStore } from '#/store';

import { useLetterSession } from '../use-letter-session';

vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

/** A-Z 全集；会话取的是它的前 N 个（N 由家长端难度范围决定） */
const ALL = Array.from({ length: 26 }, (_, i) => String.fromCodePoint(65 + i));

/** 用同一个会话实例走完一轮，返回依次看到的字母 */
function walk() {
  const session = useLetterSession();
  const seen: string[] = [];
  for (let i = 0; i < session.total.value; i += 1) {
    const item = session.current.value;
    if (!item) break;
    seen.push(item.letter);
    if (i < session.total.value - 1) session.next();
  }
  return { ...session, seen };
}

describe('英文乐园翻卡会话', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('未设置顺序时按 A-Z 顺序，且不会翻过最后一个', () => {
    const kid = useKidStore();
    const { atEnd, next, seen } = walk();

    expect(kid.moduleOrder('letters')).toBe('seq');
    expect(seen).toEqual(ALL.slice(0, seen.length));
    expect(atEnd.value).toBe(true);
    // 已在末尾，再翻不应越界
    expect(next()).toBe(false);
  });

  it('随机模式下打乱顺序，且不重不漏', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { order: 'random' } };

    const { seen } = walk();
    const inOrder = ALL.slice(0, seen.length);

    expect(seen.toSorted()).toEqual(inOrder);
    // 洗成原顺序的概率为 1/26!，可认为随机确实生效了
    expect(seen).not.toEqual(inOrder);
  });

  it('第一张往前翻不动', () => {
    const { prev } = useLetterSession();
    expect(prev()).toBe(false);
  });

  it('翻到下一张再翻回来，是同一个字母', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { order: 'random' } };

    const { current, next, prev, total } = useLetterSession();
    expect(total.value).toBeGreaterThan(1);

    const first = current.value?.letter;
    expect(next()).toBe(true);
    expect(current.value?.letter).not.toBe(first);
    expect(prev()).toBe(true);
    expect(current.value?.letter).toBe(first);
  });
});
