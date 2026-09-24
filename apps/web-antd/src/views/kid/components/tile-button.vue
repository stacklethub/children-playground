<script setup lang="ts">
/**
 * 宝宝端大图标入口卡片。
 */
defineProps<{
  bg?: string;
  desc?: string;
  emoji: string;
  label: string;
}>();

const emit = defineEmits<{ tap: [] }>();
</script>

<template>
  <button
    class="flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 active:scale-95"
    @click="emit('tap')"
  >
    <span
      class="flex h-24 w-24 items-center justify-center rounded-full text-6xl"
      :class="bg"
    >
      {{ emoji }}
    </span>
    <span class="text-2xl font-bold text-slate-700">{{ label }}</span>
    <span v-if="desc" class="text-base text-slate-400">{{ desc }}</span>
  </button>
</template>
