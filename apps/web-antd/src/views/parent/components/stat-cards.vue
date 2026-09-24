<script setup lang="ts">
import { Card } from 'ant-design-vue';

/** 报告统计卡片 */
defineProps<{
  items: { emoji: string; label: string; value: number | string }[];
}>();
</script>

<template>
  <div class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
    <Card v-for="item in items" :key="item.label">
      <div class="flex items-center gap-4">
        <span class="text-4xl">{{ item.emoji }}</span>
        <div>
          <div class="text-3xl font-bold">{{ item.value }}</div>
          <div class="text-muted-foreground text-sm">{{ item.label }}</div>
        </div>
      </div>
    </Card>
  </div>
</template>
