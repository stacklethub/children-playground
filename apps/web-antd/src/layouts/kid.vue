<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import KidCornerActions from './components/kid/kid-corner-actions.vue';
import RestOverlay from './components/kid/rest-overlay.vue';
import { useScreenGuard } from './composables/use-screen-guard';

/**
 * 宝宝端布局：全屏、无菜单，包含回家按钮、家长门禁与护眼休息提醒。
 */
const router = useRouter();
const { finishRest, resting } = useScreenGuard();
const gateOpen = ref(false);

/** 首页不显示回家按钮 */
const showHome = computed(() => router.currentRoute.value.name !== 'KidHome');

onMounted(() => {
  // 预热语音列表（部分浏览器需要先触发一次才能拿到 voices）
  window.speechSynthesis?.getVoices?.();
});
</script>

<template>
  <div
    class="kid-layout relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-gradient-to-b from-sky-200 via-amber-50 to-rose-100"
  >
    <RouterView />
    <KidCornerActions v-model:gate-open="gateOpen" :show-home="showHome" />
    <RestOverlay v-model:open="resting" @finish="finishRest" />
  </div>
</template>

<style scoped>
.kid-layout {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
