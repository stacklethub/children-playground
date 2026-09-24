import type { ChildApi } from '#/api';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import {
  bindChildApi,
  createChildApi,
  deleteChildApi,
  getChildrenApi,
  updateChildApi,
} from '#/api';
import { clearBindToken, getBindToken, setBindToken } from '#/utils/bind-token';

/**
 * 家庭状态：家长账号下的孩子档案 + 「当前学习的孩子」（设备级绑定）。
 *
 * 产品约定：宝宝端不需要登录，孩子归属由家长在该设备上登录后选择，
 * 绑定信息（孩子快照）持久化到本机，保证宝宝端断网也能玩。
 */
export const useFamilyStore = defineStore(
  'family',
  () => {
    /** 服务端返回的孩子列表 */
    const children = ref<ChildApi.ChildProfile[]>([]);
    /** 当前学习的孩子 id（设备绑定） */
    const currentChildId = ref<string>();
    /** 当前孩子的快照，供宝宝端离线使用 */
    const currentChildSnapshot = ref<ChildApi.ChildProfile>();
    const loading = ref(false);
    const loaded = ref(false);

    const currentChild = computed(
      () =>
        children.value.find((c) => c.id === currentChildId.value) ??
        currentChildSnapshot.value,
    );

    /** 是否已绑定孩子（宝宝端可用） */
    const hasCurrentChild = computed(() => Boolean(currentChild.value?.id));

    /** 全部孩子（含当前孩子） */
    function findChild(id?: string) {
      return children.value.find((c) => c.id === id);
    }

    async function fetchChildren() {
      loading.value = true;
      try {
        children.value = await getChildrenApi();
        loaded.value = true;
        // 当前孩子被删除或首次进入时，自动绑定第一个孩子
        if (
          currentChildId.value &&
          !children.value.some((c) => c.id === currentChildId.value)
        ) {
          currentChildId.value = undefined;
        }
        if (!currentChildId.value && children.value.length > 0) {
          await setCurrentChild(children.value[0]!.id);
        } else if (currentChild.value) {
          currentChildSnapshot.value = currentChild.value;
          await ensureBindToken(currentChild.value);
        }
      } finally {
        loading.value = false;
      }
    }

    /**
     * 把孩子绑定到本设备（签发宝宝端上报令牌）。
     * 令牌与孩子一一对应，切换孩子时各自持有自己的令牌。
     */
    async function ensureBindToken(child: ChildApi.ChildProfile) {
      if (getBindToken(child.id)) return;
      try {
        const result = await bindChildApi(child.id);
        setBindToken({
          childId: result.child.id,
          parentId: result.child.parentId,
          token: result.bindToken,
        });
      } catch {
        // 未登录或网络异常时跳过，宝宝端仅本地记录，稍后补传
      }
    }

    /** 绑定/切换当前学习的孩子（本设备生效） */
    async function setCurrentChild(id?: string) {
      currentChildId.value = id;
      const child = findChild(id);
      currentChildSnapshot.value = child;
      if (child) {
        await ensureBindToken(child);
      }
    }

    async function addChild(draft: ChildApi.ChildDraft) {
      const child = await createChildApi(draft);
      children.value = [...children.value, child];
      if (!currentChildId.value) {
        await setCurrentChild(child.id);
      }
      return child;
    }

    async function editChild(id: string, draft: ChildApi.ChildDraft) {
      const child = await updateChildApi(id, draft);
      children.value = children.value.map((c) => (c.id === id ? child : c));
      if (currentChildId.value === id) {
        currentChildSnapshot.value = child;
      }
      return child;
    }

    async function removeChild(id: string) {
      await deleteChildApi(id);
      clearBindToken(id);
      children.value = children.value.filter((c) => c.id !== id);
      if (currentChildId.value === id) {
        await setCurrentChild(children.value[0]?.id);
      }
    }

    function $reset() {
      children.value = [];
      currentChildId.value = undefined;
      currentChildSnapshot.value = undefined;
      loaded.value = false;
    }

    return {
      $reset,
      addChild,
      children,
      currentChild,
      currentChildId,
      currentChildSnapshot,
      editChild,
      ensureBindToken,
      fetchChildren,
      findChild,
      hasCurrentChild,
      loaded,
      loading,
      removeChild,
      setCurrentChild,
    };
  },
  {
    persist: {
      pick: ['currentChildId', 'currentChildSnapshot'],
    },
  },
);
