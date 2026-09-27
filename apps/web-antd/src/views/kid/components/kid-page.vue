<script setup lang="ts">
import { $t } from '#/locales';

/**
 * 宝宝端页面的公共外壳：标题、可滚动内容区与统一留白。
 */
defineProps<{ emoji?: string; titleKey: string }>();
</script>

<template>
  <section
    class="flex flex-1 flex-col items-center px-4 pb-20 pt-5 sm:px-6 sm:pb-28 sm:pt-10"
  >
    <h1
      class="mb-4 flex items-center gap-2 text-3xl font-black text-slate-700 sm:mb-6 sm:gap-3 sm:text-4xl"
    >
      <span v-if="emoji" class="text-4xl sm:text-5xl">{{ emoji }}</span>
      {{ $t(titleKey) }}
    </h1>
    <slot></slot>
  </section>
</template>
