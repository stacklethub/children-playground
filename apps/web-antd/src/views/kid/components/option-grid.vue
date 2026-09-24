<script setup lang="ts" generic="T extends number | string">
/**
 * 测验选项按钮组（字母 / 数字通用）。
 */
const props = withDefaults(
  defineProps<{
    activeClass?: string;
    options: T[];
  }>(),
  { activeClass: 'text-sky-500' },
);

const emit = defineEmits<{ pick: [value: T] }>();
</script>

<template>
  <div class="grid w-full max-w-2xl grid-cols-3 gap-6">
    <button
      v-for="option in props.options"
      :key="option"
      class="rounded-3xl bg-white/95 py-9 text-6xl font-black shadow-xl transition active:scale-90"
      :class="activeClass"
      @click="emit('pick', option)"
    >
      {{ option }}
    </button>
  </div>
</template>
