import type { KidCard, KidCategory, KidLetter, KidNumber, KidPinyin, KidSong } from './content';
import type { TileKey } from './modules';

import { computed } from 'vue';

import { useKidStore } from '#/store';

import {
  kidCards,
  kidCategories,
  kidLetters,
  kidNumbers,
  kidPinyin,
  kidSongs,
} from './content';
import { useCollection } from './use-collection';

export type { KidCard, KidCategory, KidLetter, KidNumber, KidPinyin, KidSong };
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
  pinyin: kidPinyin,
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
    numbers,
    pinyinList: pinyinCollection.items,
    songs,
    updateCard,
  };
}
