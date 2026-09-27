import type { LearnModule } from '#/store';

import { computed, onMounted, ref } from 'vue';

import { MODULES } from '#/data/modules';
import {
  MODULE_KEYS,
  useDeviceStore,
  useFamilyStore,
  useKidStore,
} from '#/store';

/** 报告页的模块配色由注册表派生，新增模块无需改动本文件 */
export const MODULE_META: Record<LearnModule, { color: string; key: string }> =
  Object.fromEntries(
    MODULE_KEYS.map((key) => [key, { color: MODULES[key].color, key }]),
  ) as Record<LearnModule, { color: string; key: string }>;

/**
 * 家长端学习报告数据：
 * 无后端模式，数据来源 = 本机学习记录（按所选孩子过滤）。
 */
export function useChildReport() {
  const familyStore = useFamilyStore();
  const deviceStore = useDeviceStore();
  const kidStore = useKidStore();

  /** 数据范围：'' 表示全部孩子 */
  const selectedChildId = ref<string>('');
  const loading = ref(false);

  /** 本机待同步记录（无后端模式下恒为空，保留字段兼容 UI） */
  const localPending = computed(() =>
    kidStore.pendingOf(selectedChildId.value || undefined),
  );

  /** 全部记录（本机），按时间倒序 */
  const allRecords = computed(() =>
    kidStore.recordsOf(selectedChildId.value || undefined),
  );

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

  /** 进入家长中心时：拉孩子列表 + 默认关注本机学习者 */
  async function init() {
    await familyStore.fetchChildren();
    // 默认关注本机学习者（查看范围可随时切换，不影响宝宝端归属）
    selectedChildId.value = deviceStore.boundChildId ?? '';
  }

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
    streakDays,
    totalStars,
  };
}
