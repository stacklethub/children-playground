import { computed, ref, watch } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import { useReward } from './use-reward';

/**
 * 「看图识物」分类卡片浏览会话：顶部 Tab 选分类，翻卡、朗读、首次学习计星。
 *
 * 分类以前是「小卡片网格 → 点进去」的两级路由跳转，现改为与其他模块
 * 一致的顶部 Tab 胶囊，进入即默认选中第一个分类。
 */
export function useCardSession() {
  const { cardsByCategory, categories } = useContent();
  const { reward } = useReward();

  /** 当前选中的分类 id；进入页面默认第一个 */
  const activeCategory = ref<string>('');
  const index = ref(0);
  /** 本次会话已学过的卡片（去重计星） */
  const learnedIds = new Set<string>();

  const cards = computed(() =>
    activeCategory.value ? cardsByCategory(activeCategory.value) : [],
  );
  const current = computed(() => cards.value[index.value]);
  const category = computed(() =>
    categories.value.find((c) => c.id === activeCategory.value),
  );
  const atStart = computed(() => index.value <= 0);
  const atEnd = computed(() => index.value >= cards.value.length - 1);

  /** 顶部 Tab：分类名是内容层中文素材，直接展示、不参与 i18n */
  const categoryTabs = computed(() =>
    categories.value.map((c) => ({ label: c.name, value: c.id })),
  );

  function tapCard() {
    const card = current.value;
    if (!card) return;
    // 名称、小知识属于内容层的中文素材（不参与 i18n），固定中文语音朗读。
    // 拼音只作屏幕视觉展示：拼音是拉丁字母串，交给中文 TTS 会念出怪音。
    speak(`${card.name}。${card.fact ?? ''}`, {
      lang: CONTENT_TTS_LANG,
    });
    if (!learnedIds.has(card.id)) {
      learnedIds.add(card.id);
      reward({
        itemId: card.id,
        module: 'cards',
        praise: false,
        stars: 1,
      });
    }
  }

  /**
   * 翻到上/下一张；已在两端返回 false（按钮会置灰），并朗读提示。
   * 与数字王国、中文乐园的 step 语义一致。
   */
  function step(delta: number) {
    const target = index.value + delta;
    if (target < 0 || target >= cards.value.length) {
      if (delta > 0) speak($t('kid.tts.cardsDone'));
      return false;
    }
    index.value = target;
    speak($t('kid.tts.cardsNext'));
    return true;
  }

  /** 切换分类 Tab：重置翻卡位置，朗读分类名引导 */
  function pickCategory(id: string) {
    if (id === activeCategory.value) return;
    activeCategory.value = id;
    index.value = 0;
    const target = categories.value.find((c) => c.id === id);
    if (target) {
      speak($t('kid.tts.cardsCategory', { name: target.name }));
    }
  }

  // 分类列表就绪后默认选中第一个（首次进入页面）
  watch(
    categories,
    (list) => {
      if (activeCategory.value) return;
      const first = list[0];
      if (first) activeCategory.value = first.id;
    },
    { immediate: true },
  );

  return {
    activeCategory,
    atEnd,
    atStart,
    cards,
    category,
    categoryTabs,
    current,
    index,
    pickCategory,
    step,
    tapCard,
  };
}
