import { computed, ref, watch } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import { useReward } from './use-reward';

/**
 * 「看图识物」分类卡片浏览会话：翻卡、朗读、首次学习计星。
 */
export function useCardSession(categoryId: () => string | undefined) {
  const { cardsByCategory, categories } = useContent();
  const { reward } = useReward();

  const index = ref(0);
  /** 本次会话已学过的卡片（去重计星） */
  const learnedIds = new Set<string>();

  const cards = computed(() =>
    categoryId() ? cardsByCategory(categoryId()!) : [],
  );
  const current = computed(() => cards.value[index.value]);
  const category = computed(() =>
    categories.value.find((c) => c.id === categoryId()),
  );
  /** 是否处于分类选择视图 */
  const inCategoryView = computed(() => !categoryId());

  function tapCard() {
    const card = current.value;
    if (!card) return;
    speak(`${card.name}，${card.pinyin}。${card.fact ?? ''}`);
    if (!learnedIds.has(card.id)) {
      learnedIds.add(card.id);
      reward({
        detail: card.name,
        itemId: card.id,
        module: 'cards',
        praise: false,
        stars: 1,
      });
    }
  }

  /** 下一张；已到末尾返回 true */
  function next() {
    if (index.value < cards.value.length - 1) {
      index.value += 1;
      speak($t('kid.tts.cardsNext'));
      return false;
    }
    speak($t('kid.tts.cardsDone'));
    return true;
  }

  watch(
    () => categoryId(),
    (id) => {
      index.value = 0;
      if (id) {
        const target = categories.value.find((c) => c.id === id);
        if (target) {
          speak($t('kid.tts.cardsCategory', { name: target.name }));
        }
      }
    },
  );

  return { cards, category, current, inCategoryView, index, next, tapCard };
}
