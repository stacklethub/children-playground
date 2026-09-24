<script lang="ts" setup>
import { computed } from 'vue';

import { Spin } from 'ant-design-vue';

import { $t } from '#/locales';
import { useFamilyStore } from '#/store';

import KidSelector from '../components/kid-selector.vue';
import ModulePie from '../components/module-pie.vue';
import RecordList from '../components/record-list.vue';
import StatCards from '../components/stat-cards.vue';
import TrendChart from '../components/trend-chart.vue';
import { useChildReport } from '../hooks/use-child-report';

const familyStore = useFamilyStore();
const {
  accuracy,
  allRecords,
  last7Days,
  loading,
  localPending,
  moduleDist,
  selectedChildId,
  streakDays,
  totalStars,
} = useChildReport();

const stats = computed(() => [
  { emoji: '⭐', label: $t('parent.dashboard.statStars'), value: totalStars.value },
  {
    emoji: '📚',
    label: $t('parent.dashboard.statRecords'),
    value: allRecords.value.length,
  },
  {
    emoji: '🎯',
    label: $t('parent.dashboard.statStreak'),
    value: `${streakDays.value} ${$t('parent.dashboard.days')}`,
  },
  {
    emoji: '✅',
    label: $t('parent.dashboard.statAccuracy'),
    value: `${accuracy.value}%`,
  },
]);
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <KidSelector v-model:child-id="selectedChildId" />
      <div class="text-muted-foreground flex items-center gap-3 text-sm">
        <span v-if="familyStore.children.length === 0">
          {{ $t('parent.common.noChild') }}
        </span>
        <span v-if="localPending.length > 0">
          {{ $t('parent.dashboard.localPending', { count: localPending.length }) }}
        </span>
        <Spin v-if="loading" size="small" />
      </div>
    </div>

    <StatCards :items="stats" />

    <div class="mb-5 grid gap-4 lg:grid-cols-5">
      <div class="lg:col-span-3">
        <TrendChart :data="last7Days" />
      </div>
      <div class="lg:col-span-2">
        <ModulePie :data="moduleDist" />
      </div>
    </div>

    <RecordList :records="allRecords.slice(0, 20)" />
  </div>
</template>
