<script setup lang="ts">
/**
 * 宝宝端厚底按钮。
 *
 * 手感：毛玻璃底 + 柔和投影，按下轻微缩放。
 * 主按钮文字必须是暖棕 `text-kid-ink`，**不要改回 `text-white`**：
 * 白字 on 杏色 #f0a868 实测对比度只有 2.00:1，连 WCAG「大文本」门槛 3:1
 * 都达不到（正文门槛是 4.5:1）；换成暖棕 #4a3f35 后为 5.12:1，达标。
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
    class="kid-btn inline-flex items-center justify-center gap-2 rounded-full border border-white/60 px-7 text-xl font-black shadow-lg backdrop-blur-xl transition active:scale-95 disabled:opacity-50"
    :class="
      variant === 'primary'
        ? 'bg-kid-apricot/80 text-kid-ink'
        : 'bg-white/55 text-kid-ink'
    "
    :disabled="disabled"
    type="button"
    @click="emit('tap')"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
.kid-btn {
  min-height: 64px;
}
</style>
