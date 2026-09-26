import type {
  KidCard,
  KidCategory,
  KidLetter,
  KidLevel,
  KidLogicItem,
  KidNumber,
  KidPinyin,
  KidPoem,
  KidSong,
} from './content';
import type { TileKey } from './modules';

import { computed } from 'vue';

import { useKidStore } from '#/store';

import {
  kidCards,
  kidCategories,
  kidLetters,
  kidLevels,
  kidLogicItems,
  kidNumbers,
  kidPinyin,
  kidPoems,
  kidSongs,
} from './content';
import { splitLines } from './modules';
import { useCollection } from './use-collection';

export type {
  KidCard,
  KidCategory,
  KidLetter,
  KidLevel,
  KidLogicItem,
  KidNumber,
  KidPinyin,
  KidPoem,
  KidSong,
};
export { useCollection } from './use-collection';
export type { ContentItemBase, ContentPatch } from './use-collection';

export interface CardDraft {
  categoryId: string;
  emoji: string;
  fact?: string;
  name: string;
  pinyin: string;
}

/**
 * 各模块的内置内容。
 * 新增内容型模块时在这里补一行，家长端内容管理即可管理它。
 */
/** 英文乐园的条目类型：useCollection 要 id，字母本身天然唯一，直接借用 */
export type LetterItem = KidLetter & { id: string };

const LETTER_ITEMS: LetterItem[] = kidLetters.map((item) => ({
  ...item,
  id: item.letter,
}));

const BUILTIN: Partial<Record<TileKey, { id: string }[]>> = {
  adventure: kidLevels,
  cards: kidCards,
  letters: LETTER_ITEMS,
  logic: kidLogicItems,
  pinyin: kidPinyin,
  poems: kidPoems,
};

/** 取某模块的内置内容；未注册的模块返回空数组（家长端显示空态，不报错） */
export function builtinOf(key: TileKey): { id: string }[] {
  return BUILTIN[key] ?? [];
}

/**
 * 内置内容 + 家长中心维护的覆盖项（增/改/删）合并后的响应式内容。
 *
 * 对外签名与多模块改造前保持一致，宝宝端与家长端调用方无需改动。
 */
export function useContent() {
  const kidStore = useKidStore();

  const cardCollection = useCollection<KidCard>({
    defaults: kidCards,
    key: 'cards',
  });

  const pinyinCollection = useCollection<KidPinyin>({
    defaults: kidPinyin,
    key: 'pinyin',
  });

  const poemCollection = useCollection<KidPoem>({
    defaults: kidPoems,
    key: 'poems',
  });

  /** 诗句 / 选项在家长端是逐行填写的 textarea，内置数据则是数组，统一规范 */
  const poems = computed<KidPoem[]>(() =>
    poemCollection.items.value.map((poem) => ({
      ...poem,
      lines: splitLines(poem.lines),
    })),
  );

  const levelCollection = useCollection<KidLevel>({
    defaults: kidLevels,
    key: 'adventure',
  });

  /** 关卡的两个字段在家长端都是文本，统一规范化后再交给页面 */
  const levels = computed<KidLevel[]>(() =>
    levelCollection.items.value.map((level) => ({
      ...level,
      modules: splitLines(level.modules),
      questionCount: Math.max(1, Number(level.questionCount) || 1),
    })),
  );

  const logicCollection = useCollection<KidLogicItem>({
    defaults: kidLogicItems,
    key: 'logic',
  });

  /** 同上，选项也是逐行填写 */
  const logicItems = computed<KidLogicItem[]>(() =>
    logicCollection.items.value.map((item) => ({
      ...item,
      options: splitLines(item.options),
    })),
  );

  const categories = computed<KidCategory[]>(() => [...kidCategories]);

  const cards = cardCollection.items;

  const letterCollection = useCollection<LetterItem>({
    defaults: LETTER_ITEMS,
    key: 'letters',
  });

  /**
   * 英文乐园既是内容型又是参数型：
   * 家长改过的单词/例句走覆盖项合并，数量再受「难度范围」限制（前 N 个）。
   * 三个子模式共用这一份数据，保证难度设定一致。
   */
  const letters = computed<LetterItem[]>(() =>
    letterCollection.items.value.slice(0, kidStore.moduleRange('letters')),
  );

  /** 数字数量受家长端「难度范围」限制 */
  const numbers = computed<KidNumber[]>(() =>
    kidNumbers.slice(0, kidStore.moduleRange('numbers')),
  );

  const songs = computed<KidSong[]>(() => [...kidSongs]);

  function cardsByCategory(categoryId: string): KidCard[] {
    return cards.value.filter((c) => c.categoryId === categoryId);
  }

  function addCard(draft: CardDraft) {
    cardCollection.add(draft);
  }

  function updateCard(id: string, patch: Partial<CardDraft>) {
    cardCollection.update(id, patch);
  }

  function deleteCard(id: string) {
    cardCollection.remove(id);
  }

  return {
    addCard,
    cards,
    cardsByCategory,
    categories,
    deleteCard,
    letters,
    levels,
    logicItems,
    numbers,
    pinyinList: pinyinCollection.items,
    poems,
    songs,
    updateCard,
  };
}
