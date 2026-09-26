<script setup lang="ts">
import type { KidColorName } from '#/data/kid-palette';

import { computed } from 'vue';

import { ACCENT_CLASS, KID_TABS_RESTING_FG } from './kid-tabs-accent';

/**
 * 模块内 Tab 胶囊。
 *
 * 由旧的 kid-tabs（模块内多 Tab）与 mode-tabs（learn/quiz 二选一）合并而来 ——
 * 两者本是同一个控件，分家导致样式各写一份、行为不一致。
 *
 * 配色见 `kid-tabs-accent.ts`：选中态是成对的 {底色, 文字色}，逐色算过对比度，
 * 不能统一成一个文字色（sky 必须白字，其余必须暖棕）。
 */
const props = withDefaults(
  defineProps<{
    accent?: KidColorName;
    items: Array<{ label: string; value: string }>;
  }>(),
  { accent: 'sky' },
);

const emit = defineEmits<{ change: [value: string] }>();

const accent = computed(
  () => ACCENT_CLASS[props.accent] ?? { bg: 'bg-kid-sky', fg: 'text-white' },
);

const model = defineModel<string>({ required: true });

function pick(value: string) {
  if (value === model.value) return;
  model.value = value;
  emit('change', value);
}
</script>

<template>
  <div
    class="kid-tabs mb-6 flex max-w-full flex-wrap justify-center gap-2 rounded-kid-pill border-kid-ink bg-kid-paper p-1.5 shadow-kid-hard"
  >
    <button
      v-for="item in items"
      :key="item.value"
      class="kid-tab rounded-kid-pill px-6 text-2xl font-black transition-colors duration-[220ms]"
      :class="
        model === item.value
          ? `${accent.bg} ${accent.fg}`
          : `bg-transparent ${KID_TABS_RESTING_FG}`
      "
      type="button"
      @click="pick(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
/* 与 kid-card / kid-button 同款：3px 暖棕描边 + 硬投影。
   preflight 把 `*` 的 border-width 清零了，只给 border-kid-ink 只上色不出线。 */
.kid-tabs {
  border-width: 3px;
}

/* text-2xl(24px) + font-black 才落进 WCAG「大文本」，3:1 门槛才成立；
   掉回正文档就要 4.5:1，现有配色里 coral(3.50) / berry(3.34) / sky(3.53)
   都过不了。64px 是项目自己的可点区域下限。 */
.kid-tab {
  min-height: 64px;
  border-width: 0;
}
</style>
