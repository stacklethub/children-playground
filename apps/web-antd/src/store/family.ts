import type { ChildApi } from '#/api';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import {
  createChildApi,
  deleteChildApi,
  getChildrenApi,
  updateChildApi,
} from '#/api';

import { useDeviceStore } from './device';
import { useKidStore } from './kid';

/**
 * 家长账号下的孩子档案（家长端数据，随登录态存在）。
 *
 * ⚠️ 这里**没有**「当前孩子」概念 —— 家长登录、浏览、增删孩子都不会决定
 * 宝宝端学的是谁。设备的学习者由 `store/device.ts` 单独持有，且只能由家长
 * 在「孩子管理」里显式绑定。两个状态分离，避免"登录即默认某个孩子"。
 */
export const useFamilyStore = defineStore('family', () => {
  const deviceStore = useDeviceStore();
  const kidStore = useKidStore();

  /** 服务端返回的孩子列表 */
  const children = ref<ChildApi.ChildProfile[]>([]);
  const loading = ref(false);
  const loaded = ref(false);

  function findChild(id?: string) {
    return children.value.find((c) => c.id === id);
  }

  async function fetchChildren() {
    loading.value = true;
    try {
      children.value = await getChildrenApi();
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function addChild(draft: ChildApi.ChildDraft) {
    const child = await createChildApi(draft);
    children.value = [...children.value, child];
    return child;
  }

  async function editChild(id: string, draft: ChildApi.ChildDraft) {
    const child = await updateChildApi(id, draft);
    children.value = children.value.map((c) => (c.id === id ? child : c));
    // 同步本机学习者快照，保证宝宝端显示最新名字/头像
    deviceStore.syncProfile(child);
    return child;
  }

  async function removeChild(id: string) {
    await deleteChildApi(id);
    children.value = children.value.filter((c) => c.id !== id);
    // 删除的孩子若正是本机学习者则解除设备绑定，并清理其本机缓存的记录
    deviceStore.forgetChild(id);
    kidStore.clearRecords(id);
  }

  /** 家长退出登录时清空（仅家长数据；设备侧状态见 device store） */
  function $reset() {
    children.value = [];
    loaded.value = false;
    loading.value = false;
  }

  return {
    $reset,
    addChild,
    children,
    editChild,
    fetchChildren,
    findChild,
    loaded,
    loading,
    removeChild,
  };
});
