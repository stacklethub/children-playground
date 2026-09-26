import type { KidLetter } from '#/data/content';

import { computed, ref, watch } from 'vue';

import { useContent } from '#/data/use-content';
import { useKidStore } from '#/store';

/** 打乱副本，不改动传入数组 */
function shuffle(list: KidLetter[]): KidLetter[] {
  return list
    .map((item) => ({ item, weight: Math.random() }))
    .toSorted((a, b) => a.weight - b.weight)
    .map(({ item }) => item);
}

/**
 * 英文乐园的翻卡会话。
 *
 * 家长把「字母顺序」设为随机后，必须在**进入时打乱一次并固定下来**：
 * 若每次翻页都重排，同一个字母会反复出现，孩子也记不住翻到哪了。
 * 认字母与学单词共用同一份顺序，切子模式时停在同一个字母上。
 */
export function useLetterSession() {
  const { letters } = useContent();
  const kidStore = useKidStore();

  /** 本次会话固定的条目顺序 */
  const items = ref<KidLetter[]>([]);
  const index = ref(0);

  function reset() {
    items.value =
      kidStore.moduleOrder('letters') === 'random'
        ? shuffle(letters.value)
        : [...letters.value];
    index.value = 0;
  }

  const total = computed(() => items.value.length);
  const current = computed(() => items.value[index.value]);
  const atStart = computed(() => index.value <= 0);
  const atEnd = computed(() => index.value >= total.value - 1);

  /** 前后翻页；已在边界返回 false，交给调用方决定是否忽略 */
  function step(delta: number) {
    const target = index.value + delta;
    if (target < 0 || target >= total.value) return false;
    index.value = target;
    return true;
  }

  const next = () => step(1);
  const prev = () => step(-1);

  // 家长改设置或改难度范围后重新取一轮，避免顺序与内容对不上
  watch([letters, () => kidStore.moduleOrder('letters')], reset, {
    immediate: true,
  });

  return { atEnd, atStart, current, index, next, prev, total };
}
