import type { LearnRecordPayload } from '#/api';

import { computed, onMounted, ref, watch } from 'vue';

import { getLearnReportApi } from '#/api';
import {
  type LearnModule,
  useDeviceStore,
  useFamilyStore,
  useKidStore,
} from '#/store';

export const MODULE_META: Record<LearnModule, { color: string; key: string }> =
  {
    cards: { color: '#F97316', key: 'cards' },
    letters: { color: '#3B82F6', key: 'letters' },
    numbers: { color: '#10B981', key: 'numbers' },
    songs: { color: '#8B5CF6', key: 'songs' },
  };

/**
 * 家长端学习报告数据：
 * 数据来源 = 云端（当前家长名下、按所选孩子过滤）+ 本机待同步记录（去重合并）。
 */
export function useChildReport() {
  const familyStore = useFamilyStore();
  const deviceStore = useDeviceStore();
  const kidStore = useKidStore();

  /** 数据范围：'' 表示全部孩子 */
  const selectedChildId = ref<string>('');
  const loading = ref(false);
  const serverRecords = ref<LearnRecordPayload[]>([]);

  /** 本机待同步记录（未上传成功的那部分） */
  const localPending = computed(() =>
    kidStore.pendingOf(selectedChildId.value || undefined),
  );

  /** 云端 + 本机合并去重（按记录 id），并按时间倒序 */
  const allRecords = computed(() => {
    const map = new Map<string, LearnRecordPayload>();
    for (const record of serverRecords.value) {
      map.set(record.id, record);
    }
    for (const record of localPending.value) {
      map.set(record.id, record);
    }
    return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
  });

  const totalStars = computed(() =>
    allRecords.value.reduce((sum, r) => sum + (r.stars ?? 0), 0),
  );

  const streakDays = computed(() => {
    if (allRecords.value.length === 0) return 0;
    const days = new Set(
      allRecords.value.map((r) => new Date(r.createdAt).toDateString()),
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
  });

  const accuracy = computed(() => {
    if (allRecords.value.length === 0) return 0;
    const positive = allRecords.value.filter(
      (r) => r.result !== 'wrong',
    ).length;
    return Math.round((positive / allRecords.value.length) * 100);
  });

  /** 最近 7 天每日学习次数 */
  const last7Days = computed(() => {
    const result: { count: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const start = new Date(day).setHours(0, 0, 0, 0);
      const end = start + 86_400_000;
      result.push({
        count: allRecords.value.filter(
          (r) => r.createdAt >= start && r.createdAt < end,
        ).length,
        label: `${day.getMonth() + 1}/${day.getDate()}`,
      });
    }
    return result;
  });

  /** 模块分布 */
  const moduleDist = computed(() =>
    (Object.keys(MODULE_META) as LearnModule[])
      .map((module) => ({
        itemStyle: { color: MODULE_META[module].color },
        key: MODULE_META[module].key,
        value: allRecords.value.filter((r) => r.module === module).length,
      }))
      .filter((item) => item.value > 0),
  );

  async function load() {
    loading.value = true;
    try {
      const report = await getLearnReportApi({
        childId: selectedChildId.value || undefined,
        range: 'week',
      });
      serverRecords.value = report.records ?? [];
    } catch {
      // 云端不可用时仅展示本机数据
      serverRecords.value = [];
    } finally {
      loading.value = false;
    }
  }

  /** 进入家长中心时：拉孩子列表 + 补传离线记录 + 拉报告 */
  async function init() {
    await familyStore.fetchChildren();
    // 默认关注本机学习者（查看范围可随时切换，不影响宝宝端归属）
    selectedChildId.value = deviceStore.boundChildId ?? '';
    await kidStore.syncPending();
    await load();
  }

  watch(selectedChildId, load);
  onMounted(init);

  return {
    accuracy,
    allRecords,
    init,
    last7Days,
    loading,
    localPending,
    moduleDist,
    selectedChildId,
    serverRecords,
    streakDays,
    totalStars,
  };
}
