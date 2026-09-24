<script setup lang="ts">
/**
 * 学习进度圆点。
 */
defineProps<{ total: number; current: number }>();
</script>

<template>
  <div class="mb-4 flex gap-2">
    <span
      v-for="i in total"
      :key="i"
      class="h-2.5 w-2.5 rounded-full"
      :class="i - 1 <= current ? 'bg-amber-400' : 'bg-white/70'"
    ></span>
  </div>
</template>
