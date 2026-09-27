<script setup lang="ts" generic="T extends number | string">
import { computed } from 'vue';

/**
 * 测验选项按钮组（字母 / 数字通用）。
 *
 * 列数随选项数量动态：选项少（≤4 个）时尽量排成一行，孩子一眼扫全；
 * 超过 4 个才落到 3 列换行。中文乐园考一考的 3 / 4 个选项、
 * 英文乐园的 4 个选项、数字王国的 3 个选项都因此排成单行。
 */
const props = withDefaults(
  defineProps<{
    activeClass?: string;
    options: T[];
  }>(),
  { activeClass: 'text-sky-500' },
);

const emit = defineEmits<{ pick: [value: T] }>();

const cols = computed(() => Math.min(props.options.length, 4));
</script>

<template>
  <div
    class="grid w-full max-w-4xl gap-3 sm:gap-6"
    :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
  >
    <button
      v-for="option in props.options"
      :key="option"
      class="min-w-0 break-words rounded-2xl border border-white/60 bg-white/55 px-2 py-6 font-black leading-tight shadow-lg backdrop-blur-xl transition active:scale-95 sm:rounded-3xl sm:px-3 sm:py-8"
      style="font-size: clamp(1.5rem, 5vw, 2.25rem)"
      :class="activeClass"
      @click="emit('pick', option)"
    >
      {{ option }}
    </button>
  </div>
</template>
