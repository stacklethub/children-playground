<script setup lang="ts">
/**
 * 热区层：叠在树的场景之上，只负责接住点击。
 *
 * ## 怎么与画面严格对齐
 *
 * 场景层（kid-tree.vue）为了自适应，把 `<svg>` 缩放成「刚好装下整棵树」的尺寸
 * 并居中。本层必须做**完全一样**的变换，否则热区会与画面错位。
 *
 * 做法是：场景层把缩放结果写到舞台的 CSS 变量上（`--tree-canvas-w/h`、`--tree-scale`），
 * 本层与场景层是同一个父 `<div class="absolute inset-0">` 的兄弟节点 ——
 * 变量沿 DOM 继承下来，本层用同一组变量定位自己即可。
 * 这样「缩放只算一次、两边共用」，不存在各算一遍然后漂移的风险。
 *
 * ## 为什么热区层里是「空占位」而不是木牌
 *
 * 最初这里也画了一套 `kid-plank.vue`（想保证任意容器下都对齐）。实测有两个硬伤：
 *
 * 1. **重影**：早期两层用的 `preserveAspectRatio` 不同（一个 slice、一个 none），
 *    几何映射不同 → 同一个坐标画出的木牌落在两个位置，肉眼看到每块牌子
 *    「显示两遍」。现在两层同尺寸同缩放（都靠 CSS 变量），重影的根因已消除，
 *    但仍然不在本层画牌子 —— 没有好处，只是多一份要同步的绘制代码。
 * 2. **比例失真**：`preserveAspectRatio="none"` 会把圆形绳结压成扁椭圆。
 *
 * 所以职责切干净：**木牌只由场景层画**（比例永远正确），本层只放不可见的
 * 透明占位（`<rect>` / `<circle>`，形状无关），负责接住点击。
 *
 * ## 接点击后为什么只 emit、不自己跳转
 *
 * 点木牌要播一段演出（小猪飞过去并缩小钻进牌子，见 kid-tree.vue 的 `diveInto`），
 * 演出结束后才跳转。演出在场景层，本层只负责「接住手指」，所以：
 *
 * 本层 `emit('select', key)` → `home/index.vue` 调到场景层的 `diveInto`
 * → 演出结束由场景层 `router.push`。
 *
 * 本层**不做任何跳转**，也不播语音 —— 语音由场景层在演出开始时播，
 * 否则会出现「语音先响、猪才开始飞」的割裂，或重复播两遍。
 */
import type { TileKey } from '#/data/modules';

import { computed } from 'vue';

import {
  TREE_REWARD,
  TREE_VIEWBOX,
  treeBranchesFor,
} from '#/data/island-spots';
import { useKidStore } from '#/store';

const emit = defineEmits<{ select: [key: TileKey] }>();

const kidStore = useKidStore();

/** 家长关掉的模块不出现在树上（与场景同一过滤函数，保证两边一致） */
const branches = computed(() =>
  treeBranchesFor((key) => kidStore.moduleEnabled(key)),
);
</script>

<template>
  <!--
    aria-hidden：无障碍焦点交给场景那一层（场景里整棵树的 svg 带 aria-label），
    本层只接指针，否则读屏会把每个入口念两遍。

    尺寸与位置跟随场景层的 CSS 变量（见 script 顶部注释），所以与画面像素级对齐。
    本层**不画木牌**，里面全是透明占位。
  -->
  <svg
    aria-hidden="true"
    class="tree-hotspots"
    :viewBox="`0 0 ${TREE_VIEWBOX.width} ${TREE_VIEWBOX.height}`"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- 7 块木牌：透明矩形占位（形状无关，只负责接住手指） -->
    <g
      v-for="branch in branches"
      :key="branch.key"
      class="cursor-pointer"
      @click="emit('select', branch.key)"
    >
      <!--
        点按区 200×150 画布单位 —— 比可见木牌（146×70）宽松得多。
        3-5 岁手指落点精度低，宽松的热区是能点中的唯一保证。

        高度取 150 而不是更大：相邻两层的木牌中心只隔 136（见 island-spots.ts），
        热区一旦超过这个间距就会上下互相咬住 → 点上面那块会跳到下面那块。
        150 > 136 已经有 14 的重叠，但重叠区落在两块牌之间的空隙（视觉上是树层
        与绳子），按「谁的中心更近」的实际命中效果仍可接受；再大就会明显咬到。
      -->
      <rect
        :height="150"
        :width="200"
        :x="branch.x - 100"
        :y="branch.y - 75"
        fill="#ffffff"
        fill-opacity="0"
      />
    </g>

    <!-- 树顶的「我的星星」 -->
    <g class="cursor-pointer" @click="emit('select', 'rewards')">
      <circle
        :cx="TREE_REWARD.x"
        :cy="TREE_REWARD.y"
        fill="#ffffff"
        fill-opacity="0"
        r="88"
      />
    </g>
  </svg>
</template>

<style scoped>
/*
  与 .tree-canvas 同一套定位与尺寸（用同一组 CSS 变量），这样两者的画布坐标
  一一对应。这里**不能**用 preserveAspectRatio：默认的 xMidYMid meet 在
  「容器比例 == 画布比例」时与场景层完全等价（而我们的容器尺寸就是按画布比例
  算出来的），所以直接用默认值最省事也最不容易错。
*/
.tree-hotspots {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: var(--tree-canvas-w, 520px);
  height: var(--tree-canvas-h, 940px);
  transform: translate(-50%, -50%);
}
</style>
