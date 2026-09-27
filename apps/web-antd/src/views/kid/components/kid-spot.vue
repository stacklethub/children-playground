<script setup lang="ts">
import type { IslandSpot } from '#/data/island-spots';
import type { TileKey } from '#/data/modules';

import { computed } from 'vue';

import KidIcon from './icons/kid-icon.vue';
import SpotAdventure from './icons/spot-adventure.vue';
import SpotCards from './icons/spot-cards.vue';
import SpotLetters from './icons/spot-letters.vue';
import SpotLogic from './icons/spot-logic.vue';
import SpotNumbers from './icons/spot-numbers.vue';
import SpotPinyin from './icons/spot-pinyin.vue';
import SpotPoems from './icons/spot-poems.vue';
import SpotRewards from './icons/spot-rewards.vue';
import SpotSongs from './icons/spot-songs.vue';
import KidLabel from './kid-label.vue';

const props = defineProps<{
  /** 在岛上的序号，用于错开入场与呼吸的延迟 */
  index: number;
  label: string;
  spot: IslandSpot;
}>();
const emit = defineEmits<{ select: [] }>();

/**
 * 错峰延迟。
 *
 * 不用坐标取模：`x % 7` 在现有坐标上有重复（700 与 350 都得 0），
 * 会出现两个地点完全同步浮动，破坏「各自呼吸」的效果。索引保证唯一。
 */
const popDelay = computed(() => `${(props.index * 0.07).toFixed(2)}s`);
const bobDelay = computed(() => `${(props.index * 0.19 + 0.3).toFixed(2)}s`);

/**
 * 图标坐标系 → 地点锚点的对齐偏移。
 *
 * 9 个图标都画在 100×100 的方框里：物体水平居中（中心 x = 50）、贴底
 * （地面投影椭圆的圆心 y ≈ 86）。而坐标表里的 (x, y) 是「地点落地点」——
 * 也就是物体的**中心-底部**。
 *
 * 两套约定差一个 (50, 86)：不对齐的话，每个地点都会整体向右下偏移，
 * 前排会被推出场景底部（实测逻辑挑战的底边超出视口 24px）。
 *
 * ⚠️ 这是图标与坐标表之间的契约：改图标的画法（换 viewBox、改物体在框内的
 * 位置）就必须同步改这里，否则整座岛都会错位。
 *
 * 微岛版：图标要「站」在微岛草地面之上，而不是压在沙洲上。所以 y 锚点从
 * -86 额外上抬 18px（微岛草地面顶边），让图标底部的投影椭圆落在微岛沙洲上沿。
 */
const ICON_ANCHOR = { x: 50, y: 86 } as const;

/** 图标底部相对微岛沙洲顶的上抬量：让图标「踩」在草地面而不是陷进沙里 */
const ISLE_LIFT = 18;

const iconAlign = computed(
  () => `translate(${-ICON_ANCHOR.x},${-ICON_ANCHOR.y - ISLE_LIFT})`,
);

const ICONS: Record<TileKey, unknown> = {
  adventure: SpotAdventure,
  cards: SpotCards,
  letters: SpotLetters,
  logic: SpotLogic,
  numbers: SpotNumbers,
  pinyin: SpotPinyin,
  poems: SpotPoems,
  rewards: SpotRewards,
  songs: SpotSongs,
};

const icon = computed(() => ICONS[props.spot.key]);

/**
 * 名字牌抬到图标上方多少。
 *
 * 图标经 ICON_ANCHOR + ISLE_LIFT 对齐后，顶边固定在 local y = -(86 + 18) = -104。
 * 标签与图标同处一个缩放组，两者一起被 scale 缩放 —— 所以前后排**共用同一个偏移**即可。
 * 取 -120：牌子底边落在 -112 附近，与图标顶边（-104）留 8 个单位呼吸。
 */
const LABEL_OFFSET = -120;

const transform = computed(
  () => `translate(${props.spot.x},${props.spot.y}) scale(${props.spot.scale})`,
);
</script>

<template>
  <!-- 分组名 group：悬停抬起靠 group-hover，避免用 JS 管 hover 状态 -->
  <g
    class="group cursor-pointer"
    :aria-label="label"
    data-spot
    role="button"
    tabindex="0"
    :transform="transform"
    @click="emit('select')"
    @keydown.enter="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <!--
      三层各管一件事，不能合并 —— SVG 元素的 transform 属性与 CSS transform
      是同一个属性，同在一位上会互相覆盖（本改造已经踩过两次：图形会跳到画布原点）。

      所以：位置用标签的 transform 属性，入场/呼吸/悬停各用一层独立的 <g> 做 CSS transform。
    -->
    <g class="pop" :style="{ '--d': popDelay }">
      <g class="bob" :style="{ '--d': bobDelay }">
        <g
          class="transition-transform duration-[220ms] group-hover:-translate-y-2"
        >
          <!--
            点按热区（不可见）。
            默认 SVG 只对「已绘制」区域响应指针，可点范围就只剩图标轮廓 + 沙洲，
            实测不到 40×40 —— 3-5 岁手指落点精度低，太小了。这里补一个填充色
            全透明的椭圆把热区撑到约 68×56（本地单位，还要乘 spot.scale 与场景
            缩放），比可见图形宽松得多。
            半径刻意小于「相邻岛中心距（前排 200）的一半」，两个热区不会重叠，
            不会出现「点 A 岛跳到 B 岛」。
          -->
          <ellipse
            cx="0"
            cy="-38"
            fill="#ffffff"
            fill-opacity="0"
            rx="68"
            ry="56"
          />
          <!-- 微岛底座：先画在图标后面，图标浮在岛面上成为地标 -->
          <g>
            <!-- 岛下投影 + 浪花圈（浅色海面上用深色投影 + 白浪花托出岛形） -->
            <ellipse
              cx="0"
              cy="10"
              rx="48"
              ry="13"
              fill="#2e6e8a"
              opacity=".2"
            />
            <!-- 沙洲底（微岛的海岸） -->
            <ellipse
              cx="0"
              cy="0"
              rx="44"
              ry="16"
              fill="#ffe9bd"
              stroke="#e2b96a"
              stroke-width="3.5"
            />
            <!-- 草地岛面（略小，压在沙洲上） -->
            <ellipse
              cx="0"
              cy="-2"
              rx="34"
              ry="12"
              fill="#8fd57f"
              stroke="#5da751"
              stroke-width="3.5"
            />
            <!-- 岛面高光：左上一点点亮，模拟光照 -->
            <ellipse
              cx="-6"
              cy="-5"
              rx="16"
              ry="6"
              fill="#c6ecb2"
              opacity=".7"
            />
          </g>

          <!-- 把图标的「中心-底部」对齐到地点锚点，见 ICON_ANCHOR 注释 -->
          <g :transform="iconAlign">
            <KidIcon :size="100">
              <component :is="icon" />
            </KidIcon>
          </g>
        </g>
      </g>
    </g>
    <g :transform="`translate(0,${LABEL_OFFSET})`">
      <KidLabel :text="label" />
    </g>
  </g>
</template>

<style scoped>
/* 悬停时整组轻微放大，与抬起形成层次 */
.group:hover {
  filter: drop-shadow(0 6px 0 rgb(74 63 53 / 18%));
}
</style>
