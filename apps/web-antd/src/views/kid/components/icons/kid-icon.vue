<script setup lang="ts">
/**
 * 图标外壳：统一视口与描边宽度。
 *
 * 所有模块图标都画在 100×100 坐标系里，靠这个外壳缩放 ——
 * 这样每个图标文件只需关心形状，不需要各自处理尺寸。
 */
withDefaults(defineProps<{ size?: number }>(), { size: 96 });
</script>

<template>
  <svg
    :height="size"
    :width="size"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g stroke="#4a3f35" stroke-linejoin="round" stroke-width="3">
      <slot />
    </g>
  </svg>
</template>
