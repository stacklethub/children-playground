<script setup lang="ts">
/**
 * 宝宝端厚底按钮。
 *
 * 手感来自设计令牌：3px 暖棕描边 + 硬投影。按下时按钮「沉」进投影里
 * （位移量等于投影偏移、同时抹掉投影），这是整套视觉最核心的触感反馈，
 * 替代了成人 UI 里常见的颜色变暗。
 */
withDefaults(
  defineProps<{
    disabled?: boolean;
    variant?: 'ghost' | 'primary';
  }>(),
  { disabled: false, variant: 'primary' },
);

const emit = defineEmits<{ tap: [] }>();
</script>

<template>
  <button
    class="kid-btn inline-flex items-center justify-center gap-2 rounded-kid-pill border-kid-ink px-7 text-xl font-black shadow-kid-hard transition-transform duration-[120ms] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
    :class="
      variant === 'primary'
        ? 'bg-kid-apricot text-white'
        : 'bg-kid-paper text-kid-ink'
    "
    :disabled="disabled"
    type="button"
    @click="emit('tap')"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
/* Tailwind 无 border-3 预设，用令牌统一描边宽度 */
.kid-btn {
  min-height: 64px;
  border-width: 3px;
}
</style>
