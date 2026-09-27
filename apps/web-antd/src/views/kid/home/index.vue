<script setup lang="ts">
/**
 * 宝宝端首页 —— 按视口宽高比在两种场景间切换。
 *
 * ## 为什么是两个场景而不是一个自适应场景
 *
 * 岛场景是 1000×660 的**横向**风景画（岛群在 x 200~800），树场景是 520×940 的
 * **纵向**构图。同一个场景没法同时当好横竖两种构图：竖屏用 `meet` 把岛缩到
 * 0.39 倍（名字牌看不清），宽屏用 `slice` 又会把树横向拉满、两侧空一大片。
 * 所以各用所长：
 *
 * - 宽屏（比例 ≥ 1.45）：海上群岛，海景有纵深，是小猪游泳与岛屿景深的舞台。
 * - 竖屏（比例 < 1.45）：一棵大树，8 个模块是挂在树枝上的木牌，树顶挂着我的星星。
 *
 * ## 判定为什么用 `matchMedia` 而不是量元素尺寸（两次踩坑后的结论）
 *
 * 前两版都用 `useElementSize` 量舞台容器的宽高，各踩一个坑：
 *
 * 1. **首帧量不到**（`0/0`）→ 先按竖屏渲染树，回调到达后翻成海岛，宽屏下
 *    「树一闪而过」。
 * 2. 改用 `window` 尺寸做同步初值后，**真机竖屏仍会翻成海岛** —— 因为舞台容器
 *    与 `KidIsland` 内部那个同样 `fixed inset-0` 的容器互相影响：一旦海岛层渲染
 *    出来，父容器量到的尺寸就不再是纯视口尺寸，`watch` 拿到后把判定改错。
 *
 * 根因是「用一个可能被内容反向影响的元素尺寸去决定该不该渲染这个内容」——
 * 天然是循环依赖。视口比例只与**窗口**有关，直接用 CSS 媒体查询表达最稳：
 * 它由浏览器同步求值、在 layout 之前就有确定结果，既没有首帧空窗，
 * 也不受任何子元素影响。
 *
 * 阈值 1.45 而非 1.0（正方形）：接近正方形的容器（竖屏平板、分屏窗口）里，
 * 岛的横向构图会被压得过小，而树只裁掉一点树冠与草地，明显更划算。
 * 实测两端（390×844 = 0.46、844×390 = 2.16）都远离阈值，不会来回抖动。
 */
import type { TileKey } from '#/data/modules';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { TREE_BRANCHES, TREE_REWARD } from '#/data/island-spots';
import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidIsland from '../components/kid-island.vue';
import KidTreeHotspots from '../components/kid-tree-hotspots.vue';
import KidTree from '../components/kid-tree.vue';
import { useCurrentChild } from '../hooks/use-current-child';

const { bound, childName } = useCurrentChild();

/**
 * 树场景的实例：点木牌时要把「小猪飞过去并钻进木牌」的演出交给它来演
 * （见 kid-tree.vue 的 `diveInto`）。
 */
const treeRef = ref<InstanceType<typeof KidTree> | null>(null);

/**
 * 树顶「我的星星」的坐标 —— 它不在 `TREE_BRANCHES` 里（那是 7 块木牌），
 * 但同样是可点入口，所以点它时也要把小猪送到星星上。
 */
const REWARD_TARGET = {
  key: 'rewards' as TileKey,
  x: TREE_REWARD.x,
  y: TREE_REWARD.y,
};

/**
 * 木牌/星星被点 → 小猪飞过去并缩小「钻进去」→ 演出结束由场景层跳转。
 *
 * 为什么在父组件转这一手（而不是热区层直接跳转）：小猪是**场景层**的，
 * 热区层只有透明占位。所以接点击的层（hotspots）emit → 这里按 key 找到对应
 * 目标的画布坐标 → 调到场景层的演出方法。
 */
function onTreeSelect(key: TileKey) {
  const target =
    key === 'rewards'
      ? REWARD_TARGET
      : TREE_BRANCHES.find((branch) => branch.key === key);
  if (!target) return;
  treeRef.value?.diveInto({ key, x: target.x, y: target.y });
}

/** 宽屏判定的媒体查询：最小宽高比 1.45 */
const WIDE_MEDIA_QUERY = '(min-aspect-ratio: 145/100)';

const mediaQuery = window.matchMedia(WIDE_MEDIA_QUERY);

/**
 * 同步读取初值即可 —— `matchMedia().matches` 在脚本执行时就有确定结果，
 * 不依赖任何 DOM 尺寸，所以首帧就是终值，不存在闪烁。
 */
const isWide = ref(mediaQuery.matches);

function onMediaChange(event: MediaQueryListEvent) {
  isWide.value = event.matches;
}

onMounted(() => {
  mediaQuery.addEventListener('change', onMediaChange);
  if (bound.value) {
    speak($t('kid.tts.welcome', { name: childName.value }));
  }
});

onBeforeUnmount(() => {
  mediaQuery.removeEventListener('change', onMediaChange);
});
</script>

<template>
  <BindGuard v-if="!bound" />
  <!--
    两个场景都常驻、只切显隐。为什么不用 v-if：家长在设置里改模块开关后旋转屏幕，
    若整棵树被销毁重建，木牌摆动相位与萤火虫动画都会重置（视觉上「跳一下」）；
    更麻烦的是小猪的 GSAP 时间轴 —— 组件一旦卸载，正在飞的 tween 会被打断在半空。
    代价是两套 DOM 常驻，可接受（各一个 SVG，无列表）。
  -->
  <div v-else class="fixed inset-0">
    <!-- 竖屏：一棵大树，木牌挂在树枝上，我的星星挂在树顶 -->
    <div v-show="!isWide" class="absolute inset-0">
      <KidTree ref="treeRef" />
      <KidTreeHotspots @select="onTreeSelect" />
    </div>
    <!-- 宽屏：海上群岛 -->
    <KidIsland v-show="isWide" :shown="isWide" />
  </div>
</template>
