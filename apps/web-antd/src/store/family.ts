import type { ChildApi } from '#/api';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import { i18n } from '#/locales';

import { useDeviceStore } from './device';
import { useKidStore } from './kid';

/**
 * 家长账号下的孩子档案（无后端模式：数据本机持久化，随设备保留）。
 *
 * ⚠️ 这里**没有**「当前孩子」概念 —— 家长浏览、增删孩子都不会决定
 * 宝宝端学的是谁。设备的学习者由 `store/device.ts` 单独持有，来源只有两个：
 * 首次运行时 `ensureDefaultChild` 的一次性预置，以及家长在「孩子管理」里的
 * 显式绑定。两个状态分离，避免"登录即默认某个孩子"。
 */
export const useFamilyStore = defineStore(
  'family',
  () => {
    const deviceStore = useDeviceStore();
    const kidStore = useKidStore();

    /** 本机孩子列表 */
    const children = ref<ChildApi.ChildProfile[]>([]);
    const loading = ref(false);
    const loaded = ref(false);
    /** 是否已预置过默认孩子（避免用户删光后反复补默认孩子） */
    const defaultSeeded = ref(false);

    function findChild(id?: string) {
      return children.value.find((c) => c.id === id);
    }

    async function fetchChildren() {
      loading.value = true;
      try {
        // 孩子列表由 pinia persist 持久化；这里仅标记已加载
        loaded.value = true;
        ensureDefaultChild();
      } finally {
        loading.value = false;
      }
    }

    /** 默认孩子名字取 i18n 文案；文案缺失时回落中文，避免把原始 key 当名字显示 */
    function resolveDefaultName() {
      const key = 'parent.children.defaultName';
      return i18n.global.te(key) ? i18n.global.t(key) : '宝宝';
    }

    /**
     * 首次使用时预置一个默认孩子，家长无需手动新建即可直接开始。
     * 只在「从未有过孩子」时触发一次（defaultSeeded 持久化），
     * 用户主动删光孩子后不会再次自动补默认孩子。
     */
    function ensureDefaultChild() {
      if (defaultSeeded.value) return;
      defaultSeeded.value = true;
      if (children.value.length > 0) return;

      const child: ChildApi.ChildProfile = {
        avatar: '🧒',
        createdAt: Date.now(),
        id: `child-${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        name: resolveDefaultName(),
      };
      children.value = [child];
      // 预置即默认绑定到本设备，宝宝端开箱即可学习（此后仍可在家长中心改绑）
      void deviceStore.bindChild(child);
    }

    async function addChild(draft: ChildApi.ChildDraft) {
      const child: ChildApi.ChildProfile = {
        avatar: draft.avatar ?? '🧸',
        birthday: draft.birthday,
        createdAt: Date.now(),
        id: `child-${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        name: draft.name,
      };
      children.value = [...children.value, child];
      return child;
    }

    async function editChild(id: string, draft: ChildApi.ChildDraft) {
      const child = children.value.find((c) => c.id === id);
      if (!child) throw new Error('child not found');
      const next = { ...child, ...draft };
      children.value = children.value.map((c) => (c.id === id ? next : c));
      // 同步本机学习者快照，保证宝宝端显示最新名字/头像
      deviceStore.syncProfile(next);
      return next;
    }

    async function removeChild(id: string) {
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
      defaultSeeded.value = false;
    }

    return {
      $reset,
      addChild,
      children,
      defaultSeeded,
      editChild,
      ensureDefaultChild,
      fetchChildren,
      findChild,
      loaded,
      loading,
      removeChild,
    };
  },
  {
    persist: {
      pick: ['children', 'defaultSeeded', 'loaded'],
    },
  },
);
