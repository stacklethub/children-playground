<script setup lang="ts">
import { computed } from 'vue';

/**
 * 木牌卡外壳。
 *
 * 存在的意义是消灭重复：改造前 `rounded-[3rem] bg-white/95 shadow-2xl`
 * 在 8 个文件里各写一遍，改一次要动 8 处。
 */
const props = withDefaults(defineProps<{ padded?: boolean }>(), {
  padded: true,
});

const classes = computed(() => (props.padded ? 'p-6' : 'p-0'));
</script>

<template>
  <section
    class="kid-card relative rounded-kid-card border-kid-ink bg-kid-paper shadow-kid-hard"
    :class="classes"
  >
    <slot></slot>
  </section>
</template>

<style scoped>
.kid-card {
  border-width: 3px;
}
</style>
