import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

export type LearnModule = 'cards' | 'letters' | 'numbers' | 'songs';

export interface LearnRecordItem {
  createdAt: number;
  /** 额外信息，如卡片名称 */
  detail?: string;
  id: string;
  itemId: string;
  module: LearnModule;
  result: 'learn' | 'right' | 'wrong';
}

export interface KidBadge {
  desc: string;
  emoji: string;
  id: string;
  name: string;
}

/** 徽章定义（满足条件自动授予） */
export const BADGES: (KidBadge & { check: (ctx: { records: number; stars: number }) => boolean })[] = [
  { check: (c) => c.stars >= 10, desc: '累计获得 10 颗星星', emoji: '🌟', id: 'star-10', name: '小小星光' },
  { check: (c) => c.stars >= 50, desc: '累计获得 50 颗星星', emoji: '✨', id: 'star-50', name: '闪亮之星' },
  { check: (c) => c.stars >= 100, desc: '累计获得 100 颗星星', emoji: '💫', id: 'star-100', name: '超级明星' },
  { check: (c) => c.records >= 20, desc: '完成 20 次学习', emoji: '📚', id: 'learn-20', name: '学习小达人' },
  { check: (c) => c.records >= 100, desc: '完成 100 次学习', emoji: '🎓', id: 'learn-100', name: '学习小博士' },
];

/**
 * 宝宝端全局状态：星星、学习记录、每日计划、家长维护的内容覆盖项。
 * 全部本地持久化，断网可玩。
 */
export const useKidStore = defineStore(
  'kid',
  () => {
    /** 孩子昵称 */
    const childName = ref('宝宝');
    /** 累计星星 */
    const stars = ref(0);
    /** 已获徽章 id */
    const earnedBadges = ref<string[]>([]);
    /** 学习记录（最多保留 1000 条） */
    const records = ref<LearnRecordItem[]>([]);
    /** 每日目标（各模块每天建议完成次数） */
    const dailyGoals = ref<Record<LearnModule, number>>({
      cards: 10,
      letters: 6,
      numbers: 6,
      songs: 2,
    });
    /** 单次护眼提醒时长（分钟） */
    const screenLimitMin = ref(20);
    /** 家长中心对内置内容的增删改覆盖项 */
    const contentOverrides = ref<Record<string, any>>({});

    const totalLearnCount = computed(() => records.value.length);

    /** 今天 0 点时间戳 */
    function todayStart(): number {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    /** 今日学习记录 */
    const todayRecords = computed(() =>
      records.value.filter((r) => r.createdAt >= todayStart()),
    );

    /** 今日各模块完成次数 */
    const todayCounts = computed<Record<LearnModule, number>>(() => {
      const counts: Record<LearnModule, number> = {
        cards: 0,
        letters: 0,
        numbers: 0,
        songs: 0,
      };
      for (const r of todayRecords.value) {
        counts[r.module]! += 1;
      }
      return counts;
    });

    /** 连续学习天数（含今天；今天未学则从昨天起算） */
    const streakDays = computed(() => {
      if (records.value.length === 0) return 0;
      const days = new Set(
        records.value.map((r) => new Date(r.createdAt).toDateString()),
      );
      let streak = 0;
      const cursor = new Date();
      // 今天还没学也从昨天开始数
      if (!days.has(cursor.toDateString())) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (days.has(cursor.toDateString())) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    });

    /** 增加星星并检查新徽章，返回新获得的徽章列表 */
    function addStars(n: number): KidBadge[] {
      stars.value += n;
      const ctx = { records: records.value.length, stars: stars.value };
      const newOnes: KidBadge[] = [];
      for (const badge of BADGES) {
        if (!earnedBadges.value.includes(badge.id) && badge.check(ctx)) {
          earnedBadges.value.push(badge.id);
          newOnes.push(badge);
        }
      }
      return newOnes;
    }

    /** 记录一次学习（本地持久化 + 尝试上报服务端，失败静默） */
    function addRecord(
      item: Pick<LearnRecordItem, 'itemId' | 'module' | 'detail' | 'result'>,
    ) {
      const record: LearnRecordItem = {
        ...item,
        createdAt: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      records.value.unshift(record);
      if (records.value.length > 1000) {
        records.value.length = 1000;
      }
      // 异步上报，失败不影响本地
      void reportToServer(record);
      return record;
    }

    async function reportToServer(record: LearnRecordItem) {
      try {
        const { submitLearnRecordApi } = await import('#/api');
        await submitLearnRecordApi({
          childName: childName.value,
          createdAt: record.createdAt,
          detail: record.detail,
          itemId: record.itemId,
          module: record.module,
          recordId: record.id,
          result: record.result,
        });
      } catch {
        // mock 服务不可用时静默忽略，本地记录已足够
      }
    }

    function $reset() {
      childName.value = '宝宝';
      stars.value = 0;
      earnedBadges.value = [];
      records.value = [];
      dailyGoals.value = { cards: 10, letters: 6, numbers: 6, songs: 2 };
      screenLimitMin.value = 20;
      contentOverrides.value = {};
    }

    return {
      $reset,
      addRecord,
      addStars,
      childName,
      contentOverrides,
      dailyGoals,
      earnedBadges,
      records,
      screenLimitMin,
      stars,
      streakDays,
      todayCounts,
      todayRecords,
      totalLearnCount,
    };
  },
  {
    persist: {
      pick: [
        'childName',
        'stars',
        'earnedBadges',
        'records',
        'dailyGoals',
        'screenLimitMin',
        'contentOverrides',
      ],
    },
  },
);
