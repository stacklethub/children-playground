import type {
  KidCard,
  KidCategory,
  KidLetter,
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
  kidLogicItems,
  kidNumbers,
  kidPinyin,
  kidPoems,
  kidSongs,
} from './content';
import { useCollection } from './use-collection';

export type {
  KidCard,
  KidCategory,
  KidLetter,
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
const BUILTIN: Partial<Record<TileKey, { id: string }[]>> = {
  cards: kidCards,
  logic: kidLogicItems,
  pinyin: kidPinyin,
  poems: kidPoems,
};

/**
 * 诗句 / 选项在家长端都是一个 textarea（逐行一条），内置数据则是数组。
 * 这里统一切成数组，让页面对两种来源一视同仁。
 */
function toLines(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

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

  /** 家长可能把诗句填成一个多行字符串，统一规范成句数组 */
  const poems = computed<KidPoem[]>(() =>
    poemCollection.items.value.map((poem) => ({
      ...poem,
      lines: toLines(poem.lines),
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
      options: toLines(item.options),
    })),
  );

  const categories = computed<KidCategory[]>(() => [...kidCategories]);

  const cards = cardCollection.items;

  /** 字母数量受家长端「难度范围」限制，学一学与考一考共用同一份数据 */
  const letters = computed<KidLetter[]>(() =>
    kidLetters.slice(0, kidStore.moduleRange('letters')),
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
    logicItems,
    numbers,
    pinyinList: pinyinCollection.items,
    poems,
    songs,
    updateCard,
  };
}
