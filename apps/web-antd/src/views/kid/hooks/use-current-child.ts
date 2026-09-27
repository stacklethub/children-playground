import type { ChildApi } from '#/api';

import { computed } from 'vue';

import { useDeviceStore } from '#/store';

/**
 * 宝宝端读取「这台设备的学习者」。
 *
 * 该状态来自两个来源：首次运行时系统预置的默认孩子，以及家长在家长中心的
 * 显式绑定（见 `store/device.ts`）。它不受家长登录态、孩子列表顺序、
 * 新建/删除孩子的影响；未绑定时宝宝端显示引导页，不会默认归属任何孩子。
 */
export function useCurrentChild() {
  const deviceStore = useDeviceStore();

  const child = computed<ChildApi.ChildProfile | undefined>(
    () => deviceStore.boundChild,
  );
  const childId = computed(() => child.value?.id);
  const childName = computed(() => child.value?.name ?? '');
  const bound = computed(() => Boolean(childId.value));

  return {
    bound,
    canSwitch: deviceStore.canSwitch,
    child,
    childId,
    childName,
  };
}
