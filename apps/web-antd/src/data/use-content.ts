import type { KidCard, KidCategory, KidLetter, KidNumber, KidSong } from './content';

import { computed } from 'vue';

import { useKidStore } from '#/store';

import {
  kidCards,
  kidCategories,
  kidLetters,
  kidNumbers,
  kidSongs,
} from './content';

export type { KidCard, KidCategory, KidLetter, KidNumber, KidSong };

export interface CardDraft {
  categoryId: string;
  emoji: string;
  fact?: string;
  name: string;
  pinyin: string;
}

/**
 * 内置内容 + 家长中心维护的覆盖项（增/改/删）合并后的响应式内容。
 */
export function useContent() {
  const kidStore = useKidStore();

  const categories = computed<KidCategory[]>(() => [...kidCategories]);

  const cards = computed<KidCard[]>(() => {
    const overrides = kidStore.contentOverrides;
    const result: KidCard[] = [];
    for (const card of kidCards) {
      const patch = overrides[card.id];
      if (patch?.deleted) continue;
      result.push(patch ? { ...card, ...patch, id: card.id } : card);
    }
    // 家长新增的卡片
    for (const [id, patch] of Object.entries(overrides)) {
      if (patch?.added) {
        result.push({ ...patch, id } as KidCard);
      }
    }
    return result;
  });

  const letters = computed<KidLetter[]>(() => [...kidLetters]);
  const numbers = computed<KidNumber[]>(() => [...kidNumbers]);
  const songs = computed<KidSong[]>(() => [...kidSongs]);

  function cardsByCategory(categoryId: string): KidCard[] {
    return cards.value.filter((c) => c.categoryId === categoryId);
  }

  function addCard(draft: CardDraft) {
    const id = `custom-${Date.now()}`;
    kidStore.contentOverrides[id] = { ...draft, added: true };
  }

  function updateCard(id: string, patch: Partial<CardDraft>) {
    const base = kidCards.find((c) => c.id === id);
    kidStore.contentOverrides[id] = { ...(base ?? {}), ...patch, added: !base };
  }

  function deleteCard(id: string) {
    const base = kidCards.find((c) => c.id === id);
    if (base) {
      kidStore.contentOverrides[id] = { deleted: true };
    } else {
      delete kidStore.contentOverrides[id];
    }
  }

  return {
    addCard,
    cards,
    cardsByCategory,
    categories,
    deleteCard,
    letters,
    numbers,
    songs,
    updateCard,
  };
}
