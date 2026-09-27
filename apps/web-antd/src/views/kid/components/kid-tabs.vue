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
 * 外壳用毛玻璃（半透明白 + backdrop-blur + 柔和描边 + 柔投影），
 * 选中态仍是实色主题胶囊保证对比度。
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
    class="kid-tabs mb-4 flex max-w-full flex-wrap justify-center gap-1.5 rounded-full border border-white/60 bg-white/55 p-1.5 shadow-lg backdrop-blur-xl sm:mb-6 sm:gap-2"
  >
    <button
      v-for="item in items"
      :key="item.value"
      class="kid-tab rounded-full px-4 text-xl font-black transition-colors duration-[220ms] sm:px-6 sm:text-2xl"
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
/* 对比度门槛：配色逐色算过，coral(3.50) / berry(3.34) / sky(3.53) 只过得了
   WCAG「大文本」的 3:1，过不了正文的 4.5:1。所以字号不能掉出「大文本」——
   WCAG 定义「大文本」为 ≥24px，或 **≥18.66px 的粗体**。font-black(900)
   让移动端的 text-xl(20px) 仍算大文本，门槛继续成立；再往下就违规了。
   64px 是项目自己的可点区域下限，小屏也不放宽。 */
.kid-tab {
  min-height: 64px;
  border-width: 0;
}
</style>
