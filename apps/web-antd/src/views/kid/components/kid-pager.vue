<script setup lang="ts">
import type { KidColorName } from '#/data/kid-palette';

import { computed } from 'vue';

import { $t } from '#/locales';

import { ACCENT_CLASS } from './kid-tabs-accent';

/**
 * 模块内「上一个 / n/m / 下一个」翻页条。
 *
 * 这里统一为毛玻璃视觉：
 * - 上一个 = 半透明白 ghost，
 * - 下一个 = 模块主色（复用 kid-tabs 的 ACCENT_CLASS，sky 配白字、其余暖棕字），
 * 都带柔和白描边 + 柔投影 + backdrop-blur，与 kid-button 手感一致。
 */
const props = withDefaults(
  defineProps<{
    accent?: KidColorName;
    atEnd: boolean;
    atStart: boolean;
    /** 当前下标（从 0 开始） */
    current: number;
    total: number;
  }>(),
  { accent: 'apricot' },
);

const emit = defineEmits<{ next: []; prev: [] }>();

const accent = computed(
  () =>
    ACCENT_CLASS[props.accent] ?? { bg: 'bg-kid-apricot', fg: 'text-kid-ink' },
);
</script>

<template>
  <nav class="mt-6 flex items-center gap-2 sm:mt-8 sm:gap-4">
    <button
      class="kid-pager-btn inline-flex items-center justify-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-4 text-xl font-black text-kid-ink shadow-lg backdrop-blur-xl transition active:scale-95 disabled:opacity-50 sm:gap-2 sm:px-7 sm:text-2xl"
      :disabled="atStart"
      type="button"
      @click="emit('prev')"
    >
      ← <slot name="prev">{{ $t('kid.cards.prev') }}</slot>
    </button>

    <span class="kid-pager-count text-xl font-black sm:text-2xl">
      {{ current + 1 }} / {{ total }}
    </span>

    <button
      class="kid-pager-btn inline-flex items-center justify-center gap-1.5 rounded-full border border-white/60 px-4 text-xl font-black shadow-lg backdrop-blur-xl transition active:scale-95 disabled:opacity-50 sm:gap-2 sm:px-7 sm:text-2xl"
      :class="`${accent.bg} ${accent.fg}`"
      :disabled="atEnd"
      type="button"
      @click="emit('next')"
    >
      <slot name="next">{{ $t('kid.cards.next') }}</slot> →
    </button>
  </nav>
</template>

<style scoped>
.kid-pager-btn {
  min-height: 64px;
}

/* 计数用暖棕墨色，与按钮文字一致 */
.kid-pager-count {
  min-width: 3.5rem;
  color: #4a3f35;
  text-align: center;
}

@media (min-width: 640px) {
  .kid-pager-count {
    min-width: 4.5rem;
  }
}
</style>
