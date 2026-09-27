<script setup lang="ts">
/**
 * 地点名字牌，常驻显示。
 *
 * 权衡记录：3-5 岁还不识字，文字对他们不是必需信息（名字靠 TTS 念出来）；
 * 常驻标签会把场景挤得更满。所以设计阶段做的是「悬停才出」。
 * 后按产品要求改为常驻 —— 对陪同的家长与首次上手的成人更友好。
 * 若日后觉得太挤，把 `opacity-0` 加回来、并在 KidSpot 上恢复
 * `group-hover:opacity-100` 即可回到悬停模式。
 */
defineProps<{ text: string }>();
</script>

<template>
  <g class="pointer-events-none" data-label>
    <rect
      fill="#fffdf7"
      height="26"
      rx="13"
      stroke="#4a3f35"
      stroke-width="2.8"
      width="84"
      x="-42"
      y="-16"
    />
    <text
      fill="#4a3f35"
      font-family="system-ui, sans-serif"
      font-size="15"
      font-weight="900"
      text-anchor="middle"
      y="4"
    >
      {{ text }}
    </text>
  </g>
</template>
