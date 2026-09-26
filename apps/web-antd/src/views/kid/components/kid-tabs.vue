<script setup lang="ts">
import type { KidColorName } from '#/data/kid-palette';

import { computed } from 'vue';

/**
 * 模块内 Tab 胶囊。
 *
 * 由旧的 kid-tabs（模块内多 Tab）与 mode-tabs（learn/quiz 二选一）合并而来 ——
 * 两者本是同一个控件，分家导致样式各写一份、行为不一致。
 *
 * accent 用显式映射而非模板字符串拼接：Tailwind 靠扫描源码生成类名，
 * 动态拼出的 `bg-kid-${accent}` 不会被扫描到，运行时样式会丢。
 */
const props = withDefaults(
  defineProps<{
    accent?: KidColorName;
    items: Array<{ label: string; value: string }>;
  }>(),
  { accent: 'sky' },
);

const emit = defineEmits<{ change: [value: string] }>();

const ACCENT_CLASS: Partial<Record<KidColorName, string>> = {
  apricot: 'bg-kid-apricot',
  berry: 'bg-kid-berry',
  blush: 'bg-kid-blush',
  coral: 'bg-kid-coral',
  gold: 'bg-kid-gold',
  leaf: 'bg-kid-leaf',
  lilac: 'bg-kid-lilac',
  sky: 'bg-kid-sky',
  sun: 'bg-kid-sun',
};

const accentClass = computed(() => ACCENT_CLASS[props.accent] ?? 'bg-kid-sky');

const model = defineModel<string>({ required: true });

function pick(value: string) {
  if (value === model.value) return;
  model.value = value;
  emit('change', value);
}
</script>

<template>
  <div
    class="mb-6 flex w-max gap-2 rounded-kid-pill border-kid-ink bg-kid-paper p-1.5 shadow-kid-hard"
  >
    <button
      v-for="item in items"
      :key="item.value"
      class="kid-tab rounded-kid-pill px-6 font-black transition-colors duration-[220ms]"
      :class="
        model === item.value
          ? `${accentClass} text-white`
          : 'bg-transparent text-kid-ink-soft'
      "
      type="button"
      @click="pick(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.kid-tab {
  min-height: 56px;
  border-width: 0;
}
</style>
