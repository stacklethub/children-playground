import type { ChildApi } from '#/api';

import { computed } from 'vue';

import { useFamilyStore } from '#/store';

/**
 * 宝宝端读取「当前学习的孩子」绑定信息。
 * 未绑定时宝宝端显示引导页，由家长在家长中心完成绑定。
 */
export function useCurrentChild() {
  const familyStore = useFamilyStore();

  const child = computed<ChildApi.ChildProfile | undefined>(
    () => familyStore.currentChild,
  );
  const childId = computed(() => child.value?.id);
  const parentId = computed(() => child.value?.parentId);
  const childName = computed(() => child.value?.name ?? '');
  const bound = computed(() => Boolean(childId.value && parentId.value));

  return { bound, child, childId, childName, parentId };
}
