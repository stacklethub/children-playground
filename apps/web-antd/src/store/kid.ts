import type { LearnRecordPayload } from '#/api';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import { submitLearnRecordApi, syncLearnRecordsApi } from '#/api';
import { migrateContentOverrides } from '#/data/migrate-content-overrides';
import { type LearnModule, MODULE_KEYS, MODULES } from '#/data/modules';
import { getBindToken } from '#/utils/bind-token';

export type { LearnModule };
/** 模块元信息以 `#/data/modules` 为单一事实源，这里只做再导出，调用方路径不变 */
export { MODULE_KEYS, MODULES };

export interface LearnRecordItem extends LearnRecordPayload {
  /** 是否已同步到云端 */
  synced: boolean;
}

export interface KidBadge {
  /** i18n key，如 kid.badges.star10 */
  key: string;
  check: (ctx: { records: number; stars: number }) => boolean;
  emoji: string;
  id: string;
}

/** 徽章规则（文案见 locales 的 kid.badges.*） */
export const BADGES: KidBadge[] = [
  { check: (c) => c.stars >= 10, emoji: '🌟', id: 'star-10', key: 'star10' },
  { check: (c) => c.stars >= 50, emoji: '✨', id: 'star-50', key: 'star50' },
  { check: (c) => c.stars >= 100, emoji: '💫', id: 'star-100', key: 'star100' },
  {
    check: (c) => c.records >= 20,
    emoji: '📚',
    id: 'learn-20',
    key: 'learn20',
  },
  {
    check: (c) => c.records >= 100,
    emoji: '🎓',
    id: 'learn-100',
    key: 'learn100',
  },
];

export interface WrongItem {
  module: LearnModule;
  itemId: string;
  /** 累计答错次数 */
  count: number;
  lastAt: number;
}

/** 参数型模块的家长设置 */
export interface ModuleSetting {
  /** 关闭后宝宝端首页不显示该入口；默认启用 */
  enabled?: boolean;
  /** 难度范围：宝宝端只出现前 N 个条目 */
  range?: number;
}

/**
 * 学习数据状态：记录按「孩子」归属，星星与徽章由记录派生。
 * 本地优先（断网可玩），联网后由 syncPending() 补传。
 */
export const useKidStore = defineStore(
  'kid',
  () => {
    /** 全部孩子的记录（本地缓存 + 待同步标记） */
    const records = ref<LearnRecordItem[]>([]);
    /** 家长配置的每日目标；未配置的模块由 goalOf() 回落到注册表默认值 */
    const dailyGoals = ref<Partial<Record<LearnModule, number>>>({});
    /** 单次护眼提醒时长（分钟） */
    const screenLimitMin = ref(20);
    /** 家长中心对内置内容的覆盖项：模块 key → 条目 id → patch */
    const contentOverrides = ref<Record<string, Record<string, any>>>({});
    /** 错题本：孩子 id → 错题列表 */
    const wrongBook = ref<Record<string, WrongItem[]>>({});
    /** 参数型模块的家长设置 */
    const moduleSettings = ref<Partial<Record<LearnModule, ModuleSetting>>>({});
    /** 闯关冒险进度：孩子 id → 已通关的关卡 id 列表 */
    const adventureProgress = ref<Record<string, string[]>>({});

    // ---------- 派生数据 ----------
    function recordsOf(childId?: string) {
      if (!childId) return [];
      return records.value
        .filter((r) => r.childId === childId)
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    function starsOf(childId?: string) {
      return recordsOf(childId).reduce((sum, r) => sum + (r.stars ?? 0), 0);
    }

    /** 每日目标：家长未配置时回落到注册表默认值，保证永远有值 */
    function goalOf(module: LearnModule): number {
      return dailyGoals.value[module] ?? MODULES[module].defaultGoal;
    }

    /** 模块是否启用；未配置视为启用 */
    function moduleEnabled(module: LearnModule): boolean {
      return moduleSettings.value[module]?.enabled !== false;
    }

    /** 模块难度范围；无 range 定义的模块返回 Infinity 表示不限制 */
    function moduleRange(module: LearnModule): number {
      const def = MODULES[module].range;
      if (!def) return Number.POSITIVE_INFINITY;
      return moduleSettings.value[module]?.range ?? def.default;
    }

    function pendingOf(childId?: string) {
      return childId
        ? records.value.filter((r) => r.childId === childId && !r.synced)
        : records.value.filter((r) => !r.synced);
    }

    /** 今天 0 点时间戳 */
    function todayStart() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    function todayRecordsOf(childId?: string) {
      if (!childId) return [];
      const start = todayStart();
      return recordsOf(childId).filter((r) => r.createdAt >= start);
    }

    function todayCountsOf(childId?: string): Record<LearnModule, number> {
      const counts = Object.fromEntries(
        MODULE_KEYS.map((key) => [key, 0]),
      ) as Record<LearnModule, number>;
      for (const r of todayRecordsOf(childId)) {
        if (counts[r.module as LearnModule] !== undefined) {
          counts[r.module as LearnModule] += 1;
        }
      }
      return counts;
    }

    /** 连续学习天数 */
    function streakOf(childId?: string) {
      const list = recordsOf(childId);
      if (list.length === 0) return 0;
      const days = new Set(
        list.map((r) => new Date(r.createdAt).toDateString()),
      );
      const cursor = new Date();
      if (!days.has(cursor.toDateString())) {
        cursor.setDate(cursor.getDate() - 1);
      }
      let streak = 0;
      while (days.has(cursor.toDateString())) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    }

    /** 徽章（含是否已获得） */
    function badgesOf(childId?: string) {
      const ctx = {
        records: recordsOf(childId).length,
        stars: starsOf(childId),
      };
      return BADGES.map((b) => ({ ...b, earned: b.check(ctx) }));
    }

    // ---------- 写入 ----------
    /**
     * 记录一次学习并累计星星；返回本次新解锁的徽章
     */
    function addRecord(options: {
      childId: string;
      detail?: string;
      itemId: string;
      module: LearnModule;
      parentId: string;
      result?: 'learn' | 'right' | 'wrong';
      stars?: number;
    }) {
      const before = badgesOf(options.childId)
        .filter((b) => b.earned)
        .map((b) => b.id);

      const record: LearnRecordItem = {
        childId: options.childId,
        createdAt: Date.now(),
        detail: options.detail,
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        itemId: options.itemId,
        module: options.module,
        parentId: options.parentId,
        result: options.result ?? 'right',
        stars: options.stars ?? 1,
        synced: false,
      };
      records.value = [record, ...records.value].slice(0, 3000);
      void pushToServer(record);

      const after = badgesOf(options.childId).filter((b) => b.earned);
      const newBadges = after.filter((b) => !before.includes(b.id));
      return newBadges;
    }

    async function pushToServer(record: LearnRecordItem) {
      // 没有该孩子的设备绑定令牌时仅保留本地记录，等待家长绑定后补传
      const token = getBindToken(record.childId);
      if (!token) return;
      try {
        await submitLearnRecordApi(stripLocal(record), token);
        markSynced([record.id]);
      } catch {
        // 离线或服务异常：保留本地记录，等待 syncPending
      }
    }

    function stripLocal(record: LearnRecordItem): LearnRecordPayload {
      const { synced: _synced, ...payload } = record;
      return payload;
    }

    function markSynced(ids: string[]) {
      const idSet = new Set(ids);
      records.value = records.value.map((r) =>
        idSet.has(r.id) ? { ...r, synced: true } : r,
      );
    }

    /** 补传离线期间的记录（按孩子分组，凭各自的绑定令牌，幂等） */
    async function syncPending() {
      const pending = pendingOf();
      if (pending.length === 0) return 0;

      const groups = new Map<string, LearnRecordItem[]>();
      for (const record of pending) {
        const token = getBindToken(record.childId);
        if (!token) continue;
        const group = groups.get(record.childId) ?? [];
        group.push(record);
        groups.set(record.childId, group);
      }

      let synced = 0;
      for (const [childId, group] of groups) {
        const token = getBindToken(childId)!;
        const batch = group.slice(0, 200);
        try {
          await syncLearnRecordsApi(batch.map(stripLocal), token);
          markSynced(batch.map((r) => r.id));
          synced += batch.length;
        } catch {
          // 该孩子本次补传失败，下次再试
        }
      }
      return synced;
    }

    /** 记一次答错；同一题累加次数并置顶 */
    function addWrong(childId: string, module: LearnModule, itemId: string) {
      const list = wrongBook.value[childId] ?? [];
      const existing = list.find(
        (w) => w.module === module && w.itemId === itemId,
      );
      const next: WrongItem = existing
        ? { ...existing, count: existing.count + 1, lastAt: Date.now() }
        : { count: 1, itemId, lastAt: Date.now(), module };
      wrongBook.value = {
        ...wrongBook.value,
        [childId]: [next, ...list.filter((w) => w !== existing)],
      };
    }

    /** 答对后移出错题本 */
    function removeWrong(childId: string, module: LearnModule, itemId: string) {
      const list = wrongBook.value[childId];
      if (!list) return;
      wrongBook.value = {
        ...wrongBook.value,
        [childId]: list.filter(
          (w) => !(w.module === module && w.itemId === itemId),
        ),
      };
    }

    /** 某模块的错题，最新答错的排在最前 */
    function wrongOf(childId: string, module: LearnModule): WrongItem[] {
      return (wrongBook.value[childId] ?? []).filter(
        (w) => w.module === module,
      );
    }

    /** 清空：传 module 只清该模块，不传则清空该孩子全部错题 */
    function clearWrong(childId: string, module?: LearnModule) {
      const list = wrongBook.value[childId];
      if (!list) return;
      if (module) {
        wrongBook.value = {
          ...wrongBook.value,
          [childId]: list.filter((w) => w.module !== module),
        };
        return;
      }
      // 整体清空时删键而不是写空数组，避免空键长期占据持久化体积
      const { [childId]: _dropped, ...rest } = wrongBook.value;
      wrongBook.value = rest;
    }

    /** 标记某关通关；重复调用无副作用 */
    function clearLevel(childId: string, levelId: string) {
      const cleared = adventureProgress.value[childId] ?? [];
      if (cleared.includes(levelId)) return;
      adventureProgress.value = {
        ...adventureProgress.value,
        [childId]: [...cleared, levelId],
      };
    }

    /** 清空某个孩子（或全部）的本机记录、错题本与闯关进度 */
    function clearRecords(childId?: string) {
      records.value = childId
        ? records.value.filter((r) => r.childId !== childId)
        : [];
      if (childId) {
        clearWrong(childId);
        const { [childId]: _dropped, ...rest } = adventureProgress.value;
        adventureProgress.value = rest;
      } else {
        wrongBook.value = {};
        adventureProgress.value = {};
      }
    }

    /**
     * 学习记录与每日设置都是「设备 + 孩子」级数据，不随家长退出登录清空。
     * 显式覆盖 pinia 默认的 state 重置行为；需要清理时用 clearRecords。
     */
    function $reset() {}

    return {
      $reset,
      addRecord,
      addWrong,
      adventureProgress,
      badgesOf,
      clearLevel,
      clearRecords,
      clearWrong,
      contentOverrides,
      dailyGoals,
      goalOf,
      moduleEnabled,
      moduleRange,
      moduleSettings,
      pendingOf,
      records,
      recordsOf,
      removeWrong,
      screenLimitMin,
      starsOf,
      streakOf,
      syncPending,
      todayCountsOf,
      todayRecordsOf,
      wrongBook,
      wrongOf,
    };
  },
  {
    persist: {
      pick: [
        'records',
        'dailyGoals',
        'screenLimitMin',
        'contentOverrides',
        'wrongBook',
        'moduleSettings',
        'adventureProgress',
      ],
      /**
       * 持久化数据在 store 创建后才注入，所以迁移必须挂在 afterHydrate，
       * 不能写在 setup 函数体里（那时读到的还是默认空对象）。
       * 迁移函数是幂等的，每次启动执行无副作用。
       */
      afterHydrate: (ctx) => {
        const state = ctx.store as unknown as { contentOverrides: unknown };
        state.contentOverrides = migrateContentOverrides(
          state.contentOverrides,
        );
      },
    },
  },
);
