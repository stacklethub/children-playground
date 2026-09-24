<script setup lang="ts">
import { $t } from '#/locales';

/**
 * 宝宝端页面的公共外壳：标题、可滚动内容区与统一留白。
 */
defineProps<{ emoji?: string; titleKey: string }>();
</script>

<template>
  <section class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <h1 class="mb-6 flex items-center gap-3 text-4xl font-black text-slate-700">
      <span v-if="emoji" class="text-5xl">{{ emoji }}</span>
      {{ $t(titleKey) }}
    </h1>
    <slot></slot>
  </section>
</template>
