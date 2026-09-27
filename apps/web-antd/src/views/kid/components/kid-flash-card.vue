<script setup lang="ts">
import { computed } from 'vue';

/**
 * 学习大卡（「点一点，听一听」那张投屏卡片）的统一外壳。
 *
 * 改造前这张卡在 cards / letters / numbers / pinyin 里各手写一份白卡样式
 * （`rounded-[3rem] bg-white/95 shadow-2xl`），尺寸还互相打架：
 * 认字母用 h-[52vh]，学单词 / 数字 / 古诗用 min-h-[50vh]，
 * 看图识物 / 中文乐园用 min-h-[45vh]。
 *
 * 这里统一为毛玻璃视觉：半透明白 + backdrop-blur + 柔和白描边 + 柔投影，
 * 替代早期绘本风的 3px 暖棕描边 + 硬投影。卡片可点，按下轻微缩放。
 *
 * 尺寸约定：`min-h-[45vh]` 是各页面统一的最小高度，内容更高时随内容撑开；
 * 宽度统一 `max-w-xl`。主色 / 字号仍由插槽内容自己决定，组件不越俎代庖。
 */
const props = withDefaults(
  defineProps<{
    /** 是否以可点击按钮呈现（学习卡默认可点，点一下朗读） */
    interactive?: boolean;
    /** 底部「点一点，听一听」提示语 */
    hint?: string;
  }>(),
  { interactive: true, hint: '' },
);

const emit = defineEmits<{ tap: [] }>();

const rootClass = computed(() =>
  props.interactive ? 'transition active:scale-[0.98]' : '',
);
</script>

<template>
  <component
    :is="interactive ? 'button' : 'section'"
    class="kid-flash-card relative flex min-h-[42vh] w-full max-w-xl flex-col items-center justify-center gap-3 rounded-[2rem] border border-white/60 bg-white/55 px-4 pb-14 pt-8 shadow-lg backdrop-blur-xl sm:gap-4 sm:px-10 sm:pb-16 sm:pt-10"
    :class="rootClass"
    data-star-anchor
    :type="interactive ? 'button' : undefined"
    @click="interactive && emit('tap')"
  >
    <slot></slot>

    <!-- 提示语固定贴底：无论内容多寡都在卡片底部同一高度，且由 pb-16 预留空间不重叠 -->
    <span
      v-if="hint"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 text-lg text-kid-ink-soft sm:bottom-6 sm:text-xl"
    >
      {{ hint }} 👆
    </span>
  </component>
</template>
