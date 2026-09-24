<script lang="ts" setup>
import type { LearnRecordPayload } from '#/api';

import { Card } from 'ant-design-vue';

import { $t } from '#/locales';

import { MODULE_META } from '../hooks/use-child-report';

/** 最近学习明细列表 */
defineProps<{ records: LearnRecordPayload[] }>();

function formatTime(timestamp: number) {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <Card :title="$t('parent.dashboard.recent')">
    <div
      v-if="records.length === 0"
      class="text-muted-foreground py-8 text-center"
    >
      {{ $t('parent.dashboard.empty') }}
    </div>
    <ul v-else class="divide-y">
      <li
        v-for="record in records"
        :key="record.id"
        class="flex items-center justify-between py-2.5 text-sm"
      >
        <span class="flex items-center gap-2">
          <span
            class="inline-block h-2 w-2 rounded-full"
            :style="{
              backgroundColor: MODULE_META[record.module as 'cards']?.color,
            }"
          ></span>
          {{ $t(`kid.modules.${record.module}`) }}
          <span class="text-muted-foreground">{{ record.detail }}</span>
        </span>
        <span class="text-muted-foreground">
          +{{ record.stars }} ⭐ · {{ formatTime(record.createdAt) }}
        </span>
      </li>
    </ul>
  </Card>
</template>
