<script setup lang="ts">
/**
 * 挂在圣诞树各层下摆上的木牌（纯展示，不响应点击）。
 *
 * 为什么把「木牌」独立成组件：树的场景（kid-tree.vue）与热区（kid-tree-hotspots.vue）
 * 是**两个坐标空间** —— 场景用 520×940 的画布等比缩放，热区用同一套 CSS 变量
 * 对齐。两者必须画出**完全一样**的木牌，热区才对得准。抽成一个组件，坐标只有
 * `data/island-spots.ts` 一份来源，不会各自漂移。
 *
 * ## 尺寸为什么按层缩放（`tierScale`）
 *
 * 圣诞树的上层窄、下层宽。如果每块牌子都是同一尺寸，上层两块会挤在一起（层 1
 * 底宽只有 208，两块 146 的牌子放不下），下层又显得牌子太小、空。所以按层给
 * 一个 `tierScale`（1 层最小、4 层最大），既贴合树的形状，也天然形成「越往下
 * 的入口越大」的层级感 —— 与海岛场景「近大远小」是同一个视觉语言。
 *
 * 摆动：绳子上端是定点，木牌绕它做 ±2.4° 的低频摆动 —— 真挂着的牌子就该会晃。
 * 角度刻意很小：幅度大了会像「被风吹打」，也更容易让幼儿点空。
 */
const props = withDefaults(
  defineProps<{
    /** 摆动相位，让每块牌子错开（秒） */
    delay?: number;
    label: string;
    /** 按层缩放系数（1 层 0.62 → 4 层 0.92），随树的宽窄变化 */
    tierScale?: number;
    /** 挂点，本组内用 translate 定到木牌中心 */
    x: number;
    y: number;
  }>(),
  { delay: 0, tierScale: 0.8 },
);

/** 木牌基准几何（`tierScale=1` 时的画布单位） */
const PLANK = { height: 40, rope: 30, width: 146 } as const;
</script>

<template>
  <g :transform="`translate(${props.x},${props.y}) scale(${props.tierScale})`">
    <!--
      两层 <g>，与 KidSpot 同一个理由：SVG 元素的 transform 属性与 CSS transform
      是同一个属性，同在一位上会互相覆盖（本项目已踩过两次，图形会跳到画布原点）。
      所以定位与按层缩放用外层标签的 transform 属性，摆动用内层 <g> 的 CSS transform。
    -->
    <g class="plank" :style="{ '--sway-delay': `${props.delay}s` }">
      <!-- 绳子：从挂点垂到牌子上沿 -->
      <path
        d="M0 0 L0 20"
        fill="none"
        stroke="#8a6a4a"
        stroke-linecap="round"
        stroke-width="5"
      />
      <circle
        cx="0"
        cy="4"
        fill="#f2d9a8"
        r="7"
        stroke="#7a5b3c"
        stroke-width="3"
      />

      <g :transform="`translate(0,${PLANK.rope})`">
        <!-- 牌体：挂在雪/针叶上，用暖木色，与深绿形成对比 -->
        <path
          d="M-72 0 L72 0 L64 38 L-64 38 Z"
          fill="#f0d4a4"
          stroke="#7a5b3c"
          stroke-linejoin="round"
          stroke-width="4"
        />
        <!-- 上沿高光：让牌子有厚度 -->
        <path d="M-68 4 L68 4 L66 12 L-66 12 Z" fill="#fbeacb" opacity=".9" />
        <text
          fill="#4a3f35"
          font-family="system-ui, sans-serif"
          font-size="25"
          font-weight="900"
          text-anchor="middle"
          y="29"
        >
          {{ props.label }}
        </text>
      </g>
    </g>
  </g>
</template>

<style scoped>
/*
  摆动：绕绳子上端（本组原点 (0,0)）旋转，所以 transform-origin 是 0 0 ——
  SVG 默认以包围盒中心为原点，不显式指定会变成「整块牌子原地自转」。
*/
.plank {
  transform-origin: 0 0;
  animation: plank-sway 5.2s ease-in-out infinite;
  animation-delay: var(--sway-delay, 0s);
}

@keyframes plank-sway {
  0%,
  100% {
    transform: rotate(-2.4deg);
  }

  50% {
    transform: rotate(2.4deg);
  }
}

/* 偏好减少动态：静止，但仍保留木牌本身 */
@media (prefers-reduced-motion: reduce) {
  .plank {
    animation: none;
  }
}
</style>
