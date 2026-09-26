<script setup lang="ts">
/**
 * 宝宝端厚底按钮。
 *
 * 手感来自设计令牌：3px 暖棕描边 + 硬投影。按下时按钮「沉」进投影里
 * （位移量等于投影偏移、同时抹掉投影），这是整套视觉最核心的触感反馈，
 * 替代了成人 UI 里常见的颜色变暗。
 *
 * 主按钮文字必须是暖棕 `text-kid-ink`，**不要改回 `text-white`**：
 * 白字 on 杏色 #f0a868 实测对比度只有 2.00:1，连 WCAG「大文本」门槛 3:1
 * 都达不到（正文门槛是 4.5:1）；换成暖棕 #4a3f35 后为 5.12:1，达标。
 * 顺带一提，全屏统一暖棕墨色也正是这套绘本视觉的底色，白字反而是异类。
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
        ? 'bg-kid-apricot text-kid-ink'
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
