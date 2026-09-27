<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';

import KidHud from '#/views/kid/components/kid-hud.vue';

import RestOverlay from './components/kid/rest-overlay.vue';
import { useScreenGuard } from './composables/use-screen-guard';

/**
 * 宝宝端布局：顶部 HUD + 全屏内容区。
 *
 * 改造前这里是「左侧常驻侧边栏 + 右侧内容区」—— 那是典型的后台管理范式，
 * 也是「看起来像老古董」的根因。侧边栏已移除：导航入口由首页的学习岛承担，
 * 返回入口由 HUD 承担。
 */
const route = useRoute();
const { finishRest, resting } = useScreenGuard();

/** 已在首页时不显示「回学习岛」按钮 */
const showHome = computed(() => route.name !== 'KidHome');

onMounted(() => {
  // 预热语音列表（部分浏览器需要先触发一次才能拿到 voices）
  window.speechSynthesis?.getVoices?.();
});
</script>

<template>
  <div class="kid-layout flex h-full w-full flex-col overflow-hidden">
    <KidHud :show-home="showHome" />
    <div class="flex flex-1 flex-col overflow-y-auto">
      <RouterView />
    </div>
    <RestOverlay v-model:open="resting" @finish="finishRest" />
  </div>
</template>

<style scoped>
.kid-layout {
  /*
   * 移动端视口高度：100vh 在手机上是「地址栏收起时」的高度，地址栏展开时
   * 底部会被切掉一截（按钮点不到）。dvh 是实时可见高度，才是正确的高度来源。
   * 100vh 留作老浏览器兜底。
   */
  min-height: 100vh;
  min-height: 100dvh;

  /*
   * 刘海屏 / 灵动岛 / 手势条安全区：页面已设 viewport-fit=cover（见 index.html），
   * 延伸到了系统区域，这里主动把内容让开，否则 HUD 会被状态栏压住。
   */
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);

  /* 全屏幼儿端：不要下拉刷新、不要滚到尽头继续橡皮筋回弹，避免误触打断学习 */
  overscroll-behavior: none;

  /*
   * Baloo 2 必须排在霞鹜之前：霞鹜文楷自带拉丁字形，若它在前，西文与数字
   * 也会用霞鹜渲染，Baloo 2 永远轮不到。Baloo 2 没有中文，汉字会自然落到第二位。
   */
  font-family:
    'Baloo 2', 'LXGW WenKai Screen', 'PingFang SC', 'Microsoft YaHei',
    sans-serif;

  /* 关掉双击缩放与 300ms 点击延迟；拖动滚动仍保留 */
  touch-action: manipulation;

  /* 与学习岛场景的天空渐变同源，让 HUD 与场景连成一片 */
  background: linear-gradient(
    180deg,
    #fffbf2 0%,
    #ffeeda 26%,
    #ffe2ce 52%,
    #e4f0f8 72%,
    #c9e5f4 100%
  );
}
</style>
