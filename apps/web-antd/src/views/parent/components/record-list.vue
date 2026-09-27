<script lang="ts" setup>
import type { LearnRecordPayload } from '#/api';

import { computed } from 'vue';

import { Card } from 'ant-design-vue';

import { buildLabelIndex, resolveItemLabel } from '#/data/question-bank';
import { $t } from '#/locales';
import { useKidStore } from '#/store';

import { MODULE_META } from '../hooks/use-child-report';

/** 最近学习明细列表 */
const props = defineProps<{ records: LearnRecordPayload[] }>();

const kidStore = useKidStore();

/**
 * 题目可读标签索引：学习记录只存 itemId（关联），展示时按 module+itemId 反查。
 * 索引随家长覆盖项变化重建（computed 缓存，避免每条记录都重建全量题库）。
 */
const labelIndex = computed(() => buildLabelIndex(kidStore.contentOverrides));

/** 一条记录的展示文本：临时题用内嵌 detail，内置题库题反查标签，都没有则回退 itemId */
function labelOf(record: LearnRecordPayload) {
  return (
    record.detail ??
    resolveItemLabel(record.module, record.itemId, labelIndex.value) ??
    record.itemId
  );
}

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
          <span class="text-muted-foreground">{{ labelOf(record) }}</span>
        </span>
        <span class="text-muted-foreground">
          +{{ record.stars }} ⭐ · {{ formatTime(record.createdAt) }}
        </span>
      </li>
    </ul>
  </Card>
</template>
