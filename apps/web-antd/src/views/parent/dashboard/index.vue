<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Card } from 'ant-design-vue';

import { useKidStore, type LearnModule } from '#/store';

const kidStore = useKidStore();

const trendRef = ref<EchartsUIType>();
const { renderEcharts: renderTrend } = useEcharts(trendRef);
const pieRef = ref<EchartsUIType>();
const { renderEcharts: renderPie } = useEcharts(pieRef);

const MODULE_META: Record<LearnModule, { color: string; name: string }> = {
  cards: { color: '#F97316', name: '看图识物' },
  letters: { color: '#3B82F6', name: '字母乐园' },
  numbers: { color: '#10B981', name: '数字小屋' },
  songs: { color: '#8B5CF6', name: '儿歌点播' },
};

const stats = computed(() => {
  const rightCount = kidStore.records.filter((r) => r.result !== 'wrong').length;
  const accuracy =
    kidStore.records.length > 0
      ? Math.round((rightCount / kidStore.records.length) * 100)
      : 0;
  return [
    { emoji: '⭐', label: '累计星星', value: kidStore.stars },
    { emoji: '📚', label: '学习次数', value: kidStore.records.length },
    { emoji: '🎯', label: '连续天数', value: `${kidStore.streakDays} 天` },
    { emoji: '✅', label: '正向反馈率', value: `${accuracy}%` },
  ];
});

/** 最近 7 天每天学习次数 */
const last7Days = computed(() => {
  const days: { count: number; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const start = new Date(d).setHours(0, 0, 0, 0);
    const end = start + 86_400_000;
    days.push({
      count: kidStore.records.filter(
        (r) => r.createdAt >= start && r.createdAt < end,
      ).length,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
    });
  }
  return days;
});

/** 各模块分布 */
const moduleDist = computed(() =>
  (Object.keys(MODULE_META) as LearnModule[])
    .map((m) => ({
      itemStyle: { color: MODULE_META[m]!.color },
      name: MODULE_META[m]!.name,
      value: kidStore.records.filter((r) => r.module === m).length,
    }))
    .filter((d) => d.value > 0),
);

/** 最近记录明细 */
const recentRecords = computed(() => kidStore.records.slice(0, 20));

onMounted(() => {
  renderTrend({
    grid: { bottom: 0, containLabel: true, left: '1%', right: '1%', top: '10%' },
    series: [
      {
        areaStyle: { opacity: 0.15 },
        data: last7Days.value.map((d) => d.count),
        itemStyle: { color: '#F59E0B' },
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisTick: { show: false },
      boundaryGap: false,
      data: last7Days.value.map((d) => d.label),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  });

  renderPie({
    series: [
      {
        animationType: 'scale',
        center: ['50%', '50%'],
        radius: '70%',
        type: 'pie',
        data: moduleDist.value,
      },
    ],
    tooltip: { trigger: 'item' },
  });
});

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtModule(m: string) {
  return MODULE_META[m as LearnModule]?.name ?? m;
}
</script>

<template>
  <div class="p-5">
    <!-- 统计卡片 -->
    <div class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card v-for="s in stats" :key="s.label">
        <div class="flex items-center gap-4">
          <span class="text-4xl">{{ s.emoji }}</span>
          <div>
            <div class="text-3xl font-bold">{{ s.value }}</div>
            <div class="text-muted-foreground text-sm">{{ s.label }}</div>
          </div>
        </div>
      </Card>
    </div>

    <!-- 图表 -->
    <div class="mb-5 grid gap-4 lg:grid-cols-5">
      <Card class="lg:col-span-3" title="最近 7 天学习趋势">
        <EchartsUI ref="trendRef" height="300px" />
      </Card>
      <Card class="lg:col-span-2" title="模块学习分布">
        <EchartsUI ref="pieRef" height="300px" />
      </Card>
    </div>

    <!-- 最近明细 -->
    <Card title="最近学习明细">
      <div
        v-if="recentRecords.length === 0"
        class="text-muted-foreground py-8 text-center"
      >
        还没有学习记录，让宝宝去学习岛玩一玩吧
      </div>
      <ul v-else class="divide-y">
        <li
          v-for="r in recentRecords"
          :key="r.id"
          class="flex items-center justify-between py-2.5 text-sm"
        >
          <span class="flex items-center gap-2">
            <span
              class="inline-block h-2 w-2 rounded-full"
              :style="{ backgroundColor: MODULE_META[r.module as LearnModule]?.color }"
            ></span>
            {{ fmtModule(r.module) }}
            <span class="text-muted-foreground">{{ r.detail }}</span>
          </span>
          <span class="text-muted-foreground">{{ fmtTime(r.createdAt) }}</span>
        </li>
      </ul>
    </Card>
  </div>
</template>
