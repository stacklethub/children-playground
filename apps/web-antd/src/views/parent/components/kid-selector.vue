<script setup lang="ts">
import { Select } from 'ant-design-vue';

import { $t } from '#/locales';
import { useFamilyStore } from '#/store';

/**
 * 数据范围选择：某个孩子 / 全部孩子。
 */
const selectedChildId = defineModel<string>('childId', { default: '' });

const familyStore = useFamilyStore();
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-muted-foreground text-sm">
      {{ $t('parent.dashboard.scope') }}
    </span>
    <Select v-model:value="selectedChildId" class="w-48">
      <Select.Option value="">{{ $t('parent.dashboard.allChildren') }}</Select.Option>
      <Select.Option
        v-for="child in familyStore.children"
        :key="child.id"
        :value="child.id"
      >
        {{ child.avatar }} {{ child.name }}
      </Select.Option>
    </Select>
  </div>
</template>
