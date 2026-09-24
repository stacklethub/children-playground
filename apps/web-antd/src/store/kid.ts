import type { LearnRecordPayload } from '#/api';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import { submitLearnRecordApi, syncLearnRecordsApi } from '#/api';
import { getBindToken } from '#/utils/bind-token';

export type LearnModule = 'cards' | 'letters' | 'numbers' | 'songs';

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

export const MODULE_KEYS: LearnModule[] = [
  'cards',
  'letters',
  'numbers',
  'songs',
];

/**
 * 学习数据状态：记录按「孩子」归属，星星与徽章由记录派生。
 * 本地优先（断网可玩），联网后由 syncPending() 补传。
 */
export const useKidStore = defineStore(
  'kid',
  () => {
    /** 全部孩子的记录（本地缓存 + 待同步标记） */
    const records = ref<LearnRecordItem[]>([]);
    /** 每日目标 */
    const dailyGoals = ref<Record<LearnModule, number>>({
      cards: 10,
      letters: 6,
      numbers: 6,
      songs: 2,
    });
    /** 单次护眼提醒时长（分钟） */
    const screenLimitMin = ref(20);
    /** 家长中心对内置内容的覆盖项 */
    const contentOverrides = ref<Record<string, any>>({});

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
      const counts: Record<LearnModule, number> = {
        cards: 0,
        letters: 0,
        numbers: 0,
        songs: 0,
      };
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

    /** 清空某个孩子（或全部）的本机记录 */
    function clearRecords(childId?: string) {
      records.value = childId
        ? records.value.filter((r) => r.childId !== childId)
        : [];
    }

    /**
     * 学习记录与每日设置都是「设备 + 孩子」级数据，不随家长退出登录清空。
     * 显式覆盖 pinia 默认的 state 重置行为；需要清理时用 clearRecords。
     */
    function $reset() {}

    return {
      $reset,
      addRecord,
      badgesOf,
      clearRecords,
      contentOverrides,
      dailyGoals,
      pendingOf,
      records,
      recordsOf,
      screenLimitMin,
      starsOf,
      streakOf,
      syncPending,
      todayCountsOf,
      todayRecordsOf,
    };
  },
  {
    persist: {
      pick: ['records', 'dailyGoals', 'screenLimitMin', 'contentOverrides'],
    },
  },
);
