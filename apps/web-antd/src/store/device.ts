import type { ChildApi } from '#/api';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { clearBindToken, getBindToken, setBindToken } from '#/utils/bind-token';

/**
 * 设备侧状态：这台设备（浏览器）当前的宝宝端学习者。
 *
 * 与「家长账号状态」（`store/family.ts`）严格分离，这是亲子关系的核心约定：
 * - 登录家长账号 **不等于** 选择了这台设备的学习者；
 * - 本设备的学习者只由两个来源产生：① **首次运行**时系统预置的默认孩子
 *   （一次性，见 `family.ts` 的 `ensureDefaultChild`）；② 家长在家长中心的
 *   **显式绑定**。除此之外，任何列表顺序、新建/删除孩子都不会隐式改变它；
 * - 家长退出登录不会清空本状态与宝宝端的本地记录（设备级数据）。
 */
export const useDeviceStore = defineStore(
  'device',
  () => {
    /** 本机当前学习者 */
    const boundChild = ref<ChildApi.ChildProfile>();
    /** 本机绑定过的孩子（供家长在宝宝端门禁后切换） */
    const knownChildren = ref<ChildApi.ChildProfile[]>([]);

    /** 本机是否已选择学习者（宝宝端可玩的前提） */
    const bound = computed(() => Boolean(boundChild.value?.id));
    const boundChildId = computed(() => boundChild.value?.id);
    /** 本机有多个可切换的学习者 */
    const canSwitch = computed(() => knownChildren.value.length > 1);

    function remember(child: ChildApi.ChildProfile) {
      knownChildren.value = [
        ...knownChildren.value.filter((c) => c.id !== child.id),
        child,
      ];
    }

    /**
     * 显式绑定：把某个孩子设为这台设备的学习者（家长在家长中心操作）。
     * 无后端模式：直接在本机记录绑定关系，不再签发上报令牌。
     */
    async function bindChild(child: ChildApi.ChildProfile) {
      setBindToken({ childId: child.id });
      remember(child);
      boundChild.value = child;
      return child;
    }

    /** 切换本机学习者（仅限已在本机绑定过的孩子） */
    function switchChild(childId: string) {
      const child = knownChildren.value.find((c) => c.id === childId);
      if (!child || !getBindToken(childId)) return false;
      boundChild.value = child;
      return true;
    }

    /** 家长改了名字/头像后同步本机快照 */
    function syncProfile(child: ChildApi.ChildProfile) {
      if (boundChild.value?.id === child.id) {
        boundChild.value = { ...boundChild.value, ...child };
      }
      knownChildren.value = knownChildren.value.map((c) =>
        c.id === child.id ? { ...c, ...child } : c,
      );
    }

    /** 孩子被删除：解除本机绑定（含上报令牌与历史入口） */
    function forgetChild(childId: string) {
      clearBindToken(childId);
      knownChildren.value = knownChildren.value.filter((c) => c.id !== childId);
      if (boundChild.value?.id === childId) {
        boundChild.value = undefined;
      }
    }

    /** 解除当前学习者：宝宝端回到「未选择学习者」引导页（令牌保留，便于恢复） */
    function unbindCurrent() {
      const id = boundChild.value?.id;
      if (!id) return;
      boundChild.value = undefined;
      knownChildren.value = knownChildren.value.filter((c) => c.id !== id);
    }

    /**
     * 设备状态不随家长退出登录清空 —— 显式覆盖 pinia 默认的 state 重置行为。
     * 需要清理时用 forgetChild / unbindCurrent。
     */
    function $reset() {}

    return {
      $reset,
      bindChild,
      bound,
      boundChild,
      boundChildId,
      canSwitch,
      forgetChild,
      knownChildren,
      switchChild,
      syncProfile,
      unbindCurrent,
    };
  },
  {
    persist: {
      pick: ['boundChild', 'knownChildren'],
    },
  },
);
