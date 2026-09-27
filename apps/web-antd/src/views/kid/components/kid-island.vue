<script setup lang="ts">
import type { IslandSpot } from '#/data/island-spots';
import type { TileKey } from '#/data/modules';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useElementSize } from '@vueuse/core';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

import { ISLAND_VIEWBOX, spotsFor } from '#/data/island-spots';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import KidSpot from './kid-spot.vue';

const emit = defineEmits<{ select: [key: TileKey] }>();

gsap.registerPlugin(MotionPathPlugin);

const router = useRouter();
const kidStore = useKidStore();

/** 舞台容器：用它的实际宽高判断适配模式（见 fit） */
const stageEl = ref<HTMLElement | null>(null);
const { height: stageHeight, width: stageWidth } = useElementSize(stageEl);

/** 场景坐标系的宽高比，用来判断容器是「比场景更扁」还是「比场景更瘦」 */
const SCENE_RATIO = ISLAND_VIEWBOX.width / ISLAND_VIEWBOX.height;

/**
 * 舞台适配模式 —— 移动端改造的核心。
 *
 * 场景是一张 1000×660 的**横向**风景画（岛群分布在 x 200~800），
 * 用「铺满裁切」（slice）在竖屏手机上会把左右两端直接裁掉，7 座岛看不全；
 * 所以按容器宽高比切换：
 *
 * - `'slice'`：容器比场景更「扁」（横屏手机 / 平板 / 桌面）——铺满裁切，
 *   保留原有的「满屏海景」观感，超出的天空裁掉。
 * - `'meet'` ：容器比场景更「瘦」（竖屏手机 / 竖屏平板）——整体等比缩放、
 *   **不裁切**，7 座岛全部可见；场景贴底对齐，上方留白补一段天空
 *   （`.island-sky`，接缝与场景天空顶部同色）。
 *
 * 代价说明（用户已确认）：竖屏 390px 宽的手机要把 1000 单位缩到 0.39 倍，
 * 因此岛与名字牌都会明显变小。这是「7 座岛全可见」的必然代价 —— 想要大岛
 * 就得裁切左右两端。横过来（横屏）观感最好。
 */
const fit = computed<'meet' | 'slice'>(() => {
  const w = stageWidth.value;
  const h = stageHeight.value;
  if (!w || !h) return 'slice';
  return w / h >= SCENE_RATIO ? 'slice' : 'meet';
});

const preserveAspectRatio = computed(() =>
  fit.value === 'meet' ? 'xMidYMax meet' : 'xMidYMax slice',
);

/** 家长关掉的模块不出现在岛上 */
const spots = computed(() => spotsFor((key) => kidStore.moduleEnabled(key)));

/** 模块 key → 路由 name，用于跳转 */
const ROUTE_NAME: Record<TileKey, string> = {
  adventure: 'KidAdventure',
  cards: 'KidCards',
  letters: 'KidLetters',
  logic: 'KidLogic',
  numbers: 'KidNumbers',
  pinyin: 'KidPinyin',
  poems: 'KidPoems',
  rewards: 'KidRewards',
  songs: 'KidSongs',
};

/**
 * 粉色小猪：飞行的吉祥物（不是可点击的入口，而是点菜单时的飞行反馈）。
 *
 * 交互语义（用户确认）：
 * - 点某座微岛（菜单）→ 小猪从当前位置飞到那座岛，落地后进入该模块。
 * - 小猪本身不再响应点击，只负责演出「我飞过去啦」。
 *
 * 小猪的坐标是 SVG viewBox 空间（0..1000 × 0..660），与微岛坐标表同空间。
 * 初始停在画面左下角的海面上。
 */
const PIG_HOME = { x: 120, y: 600 } as const;

/** 小猪的 SVG <g> 元素引用，GSAP 直接驱动它的 x/y/scale */
const pigEl = ref<null | SVGGElement>(null);

/** 小猪内层「游泳姿态」组：游动时做起伏 + 摇摆，飞行时复位 */
const swimEl = ref<null | SVGGElement>(null);

const isFlying = ref(false);

/**
 * 整片海的自由游泳路线（闭合曲线）—— 环绕岛群外围，避开所有菜单点。
 *
 * 7 座岛集中在中央（x 200~800、y 376~625）。这条闭合曲线贴着岛群四周游：
 * - 顶部窄带 y≈412（从山脚 adventure 与后排岛之间穿过，山脚岛在更上方）
 * - 底部宽海面 y≈640~650（前排岛沙洲底 ≈625 之下）
 * - 左右两侧 x≈120 / 905（岛群外）
 * 于是猪在整片海绕大圈，又不会撞进任何一座菜单岛。
 * `ease: 'none'` 匀速游动，慢悠悠的，符合「自由游泳」的悠闲感。
 */
const SWIM_PATH =
  'M 120 620 ' +
  'C 120 520, 120 460, 150 430 ' +
  'C 250 412, 360 412, 450 415 ' +
  'C 560 415, 680 415, 780 415 ' +
  'C 860 415, 905 445, 905 505 ' +
  'C 905 565, 905 615, 870 638 ' +
  'C 780 652, 690 650, 600 645 ' +
  'C 510 640, 440 645, 340 645 ' +
  'C 230 645, 150 640, 120 620 Z';

/** 游泳相关 tween：漫游（驱动 pigEl）+ 姿态（驱动 swimEl），飞行前全部 kill */
let swimTweens: gsap.core.Tween[] = [];

/** 记录小猪上一次插入的参考节点，避免每帧无谓地重排 DOM */
let lastSpotRef: Node | null = null;

/**
 * 让猪按「远近」正确穿插在岛之间（SVG 没有 z-index，只能靠 DOM 顺序）。
 *
 * 比较猪的 y 与每座岛的 y：猪在岛「背面」（y 更小 = 更远）就移到该岛之前绘制
 * （被岛遮住）；猪在岛「前面」（y 更大 = 更近）就移到岛之后（挡住岛）。
 * 只在「层级真的变了」时才动 DOM，避免每帧移动节点触发重排。
 */
function syncPigLayer() {
  const pig = pigEl.value;
  const svg = pig?.parentElement;
  if (!pig || !svg) return;

  const pigY = gsap.getProperty(pig, 'y') as number;
  const nodes = svg.querySelectorAll<SVGGElement>('[data-spot]');
  const ordered = spots.value; // 与 DOM 渲染顺序一致（同一个 v-for 源）

  // 找第一座 y > 猪 y 的岛，猪应插到它前面（被它遮住）
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    const spotY = ordered[i]?.y ?? Number.POSITIVE_INFINITY;
    if (spotY > pigY) {
      if (lastSpotRef !== node) {
        node.before(pig);
        lastSpotRef = node;
      }
      return;
    }
  }

  // 猪比所有岛都靠下（最近），放最后（挡住所有岛）
  if (lastSpotRef !== null) {
    svg.append(pig);
    lastSpotRef = null;
  }
}

/** 飞行时把猪提到最上层：它在空中，不能被任何岛挡住 */
function bringPigToFront() {
  const pig = pigEl.value;
  pig?.parentElement?.append(pig);
  lastSpotRef = null;
}

/**
 * 首次进来时小猪在整片海里自由游泳：
 * - 漫游：沿 SWIM_PATH 绕整片海循环（驱动外层 pigEl 的全局位置）；
 * - 姿态：内层 swimEl 做轻微起伏 + 摇摆，让身体有韵律感。
 * 两层各管各的，飞行时一并停止。
 */
function startSwimming() {
  const pig = pigEl.value;
  const pose = swimEl.value;
  if (!pig || !pose) return;

  swimTweens = [
    // 整片海漫游：匀速沿闭合路径绕圈，永不停止；每帧按 y 重新排层，让猪在岛后/岛前正确穿插
    gsap.to(pig, {
      motionPath: { path: SWIM_PATH, autoRotate: false },
      duration: 36,
      ease: 'none',
      repeat: -1,
      onUpdate: syncPigLayer,
    }),
    // 姿态：上下起伏
    gsap.to(pose, {
      y: -7,
      duration: 2.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    }),
    // 姿态：身体轻微左右摇摆，模拟划水的韵律
    gsap.to(pose, {
      rotation: 4,
      duration: 3.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    }),
  ];
}

/** 飞行前停止游泳：漫游 tween kill 后小猪停在当前位置，作为飞行起点；姿态层复位 */
function stopSwimming() {
  for (const tween of swimTweens) tween.kill();
  swimTweens = [];
  if (swimEl.value) gsap.set(swimEl.value, { y: 0, rotation: 0 });
}

/**
 * 点某座小岛 → 小猪飞过去，落地后进入该模块。
 *
 * 用 GSAP 而非 CSS transition，原因有二：
 * 1. GSAP 操作 SVG 元素时，x/y/scale 直接落在 viewBox 坐标系（无单位），
 *    不会像 CSS `translate(120px, 600px)` 那样被当成屏幕像素、把小猪甩到画面外。
 * 2. 用 `motionPath` 让飞行沿一条「拱形贝塞尔」：从当前位置爬升到高空（高于
 *    所有岛顶），再落到目标岛 —— 平滑地**绕过中间所有菜单**，而不是直线穿岛。
 *
 * 语音在飞行一开始就播（先出声确认「我点到了什么」），落地后再真正跳转。
 */
function flyTo(target: IslandSpot) {
  if (isFlying.value) return;

  const el = pigEl.value;
  if (!el) return;

  isFlying.value = true;
  // 停止自由游泳并把内层复位，让飞行从干净位置出发、落点不被游泳位移带偏
  stopSwimming();
  // 飞行时猪在空中，提到最上层，不被任何岛遮挡
  bringPigToFront();
  // 先出声再跳转：3-5 岁靠语音确认「我点到了什么」
  speak($t(`kid.modules.${target.key}`));

  const landY = target.y;
  const landScale = target.scale;

  // 读取小猪当前位置（GSAP 记忆的 viewBox 坐标），作为飞行起点
  const startX = gsap.getProperty(el, 'x') as number;
  const startY = gsap.getProperty(el, 'y') as number;

  // 拱顶高度：必须高于所有微岛的顶边（最高的是后排名字牌顶 ≈ y=406）。
  // 取 250 —— 飞得足够高，弧线夸张明显，从高空掠过所有菜单，绝不直线穿岛。
  const ARC_TOP = 250;

  // 起点 → 拱顶 → 终点 的三次贝塞尔。
  // 两个控制点不仅拉到 ARC_TOP 高空，还各自向中点收拢 20%，让曲线在顶点处
  // 更「圆」、更有弧线感，而不是一段平直的爬升+下降。
  const dx = target.x - startX;
  const flightPath = `M ${startX} ${startY} C ${startX + dx * 0.2} ${ARC_TOP}, ${target.x - dx * 0.2} ${ARC_TOP}, ${target.x} ${landY}`;

  gsap
    .timeline({
      onComplete: () => {
        isFlying.value = false;
        emit('select', target.key);
        router.push({ name: ROUTE_NAME[target.key] });
      },
    })
    // 1) 沿饱满拱形飞行：慢速爬到高空、越过所有岛、落到目标岛，同时缩放到目标比例。
    //    sine.inOut 速度变化柔和，中段不会突兀加速，配合 2.4s 让过程清楚可见。
    .to(el, {
      motionPath: { path: flightPath, autoRotate: false },
      scale: landScale,
      duration: 2.4,
      ease: 'sine.inOut',
    })
    // 2) 落地回弹：先压一下再弹起，模拟落在沙洲上的缓冲
    .to(el, {
      y: landY + 10,
      scale: landScale * 0.94,
      duration: 0.16,
      ease: 'power2.in',
    })
    .to(el, { y: landY, scale: landScale, duration: 0.24, ease: 'bounce.out' })
    // 3) 短暂停留，让幼儿确认「小猪落在了这座岛」再进模块
    .to(el, { duration: 0.5 });
}

/**
 * 3D 轻微跟随视角：指针在视口内的位置映射成 -1..1，
 * 驱动场景 rotateY / rotateX 的微小摆动。范围刻意收得很小，
 * 只给「活起来」的立体感，不让幼儿觉得场景在乱晃。
 */
/**
 * 3D 轻微跟随视角：只做水平方向（rotateY）的极轻微摆动。
 *
 * 关键教训：之前用 `perspective + rotateX` 做「俯视纵深」，但 SVG 本身是一张
 * 竖构图的正视风景画（天空在上、海在中、岛在下）。给它套 rotateX 俯视，等于
 * 把这张竖着的画向后仰倒 —— 视觉上岛就像「竖起来 / 要立起来」，而不是
 * 远远看见一座躺卧在海面上的岛。所以这里**刻意去掉 rotateX**，只保留
 * 极小幅度的 rotateY（左右），既保留一点立体感，又不会破坏「平视看岛」的构图。
 */
const tiltX = ref(0);
const sceneStyle = computed(() => ({
  transform: `rotateY(${(tiltX.value * 1.6).toFixed(2)}deg)`,
}));

function onPointerMove(event: PointerEvent) {
  const { innerWidth } = window;
  tiltX.value = (event.clientX / innerWidth) * 2 - 1;
}

function onPointerLeave() {
  tiltX.value = 0;
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // 用 GSAP 设置小猪初始位置（viewBox 坐标），后续飞行动画会从 GSAP
  // 记忆的当前值继续，无需再手动维护位置状态。
  gsap.set(pigEl.value, { x: PIG_HOME.x, y: PIG_HOME.y, scale: 0.9 });

  // 首次进来：小猪在海里自由游泳（左右游动 + 起伏），营造欢迎氛围
  startSwimming();
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  stopSwimming();
});
</script>

<template>
  <!--
    铺满整个视口，HUD 浮在它上面。

    宽屏是 SVG 版的 `object-fit: cover`：等比放大到覆盖视口，超出的部分裁掉，
    不变形。`xMidYMax` 是刻意选的锚点：按**底部**对齐裁切。用居中的 `xMidYMid`
    会在宽屏下把底部裁掉 —— 而 7 座微岛全在下半部分（海面上），绝不能裁到交互
    元素。代价是超宽屏会失去一部分天空（太阳与云）。

    竖屏（手机竖持）不能再用裁切：场景是横向长图，裁掉左右两端就等于裁掉岛。
    这时整体切换为「等比缩放不裁切」（见 script 里 fit 的注释），上方用
    `.island-sky` 补一段天空。

    外层 `.island-stage` 是舞台容器（纵向 flex：留白 + 场景）；`.island-tilt`
    只做 rotateY 的水平微摆，给一点「活起来」的立体感。**刻意不用
    perspective + rotateX**：那会让竖构图的正视风景画向后仰倒，场景看起来像
    「竖起来」，而不是平视的海上群岛。
  -->
  <div
    ref="stageEl"
    class="island-stage island-enter fixed inset-0 flex flex-col overflow-hidden"
    @pointerleave="onPointerLeave"
  >
    <!--
      竖屏（更「瘦」的容器）：svg 按 viewBox 等比缩放后铺不满高度，上方留白
      用这段天空补齐 —— 渐变的末端与场景天空顶部（skyA 的 0% stop）同色，
      所以看不出接缝。宽屏下不渲染，svg 自己铺满舞台（与改造前一致）。
    -->
    <div v-if="fit === 'meet'" class="island-sky min-h-0 flex-1"></div>
    <svg
      class="island-tilt w-full"
      :class="fit === 'meet' ? 'shrink-0' : 'h-full flex-1'"
      :style="sceneStyle"
      :preserveAspectRatio="preserveAspectRatio"
      viewBox="0 0 1000 660"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      :aria-label="$t('kid.app.name')"
    >
      <defs>
        <linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9bd6ff" />
          <stop offset="34%" stop-color="#cdeaff" />
          <stop offset="58%" stop-color="#ffe9d6" />
          <stop offset="76%" stop-color="#ffd9c0" />
          <stop offset="100%" stop-color="#f6c9ae" />
        </linearGradient>
        <linearGradient id="seaA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7ec8e6" />
          <stop offset="40%" stop-color="#5fb7dd" />
          <stop offset="100%" stop-color="#3f9bc7" />
        </linearGradient>
        <radialGradient id="haloA">
          <stop offset="0%" stop-color="#fff3c4" stop-opacity=".95" />
          <stop offset="100%" stop-color="#fff3c4" stop-opacity="0" />
        </radialGradient>
        <filter id="blurA" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id="blurB" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width="1000" height="660" fill="url(#skyA)" />

      <!-- 太阳 -->
      <g class="sun-halo">
        <circle cx="858" cy="96" r="120" fill="url(#haloA)" />
      </g>
      <g
        class="rays"
        opacity=".38"
        stroke="#ffd98e"
        stroke-width="7"
        stroke-linecap="round"
      >
        <path
          d="M858 96 L858 -22 M858 96 L858 214 M858 96 L740 96 M858 96 L976 96 M858 96 L775 13 M858 96 L941 179 M858 96 L775 179 M858 96 L941 13"
        />
      </g>
      <circle
        cx="858"
        cy="96"
        r="43"
        fill="#ffd766"
        stroke="#f0a83c"
        stroke-width="3"
      />

      <!-- 云 -->
      <g fill="#ffffff" opacity=".96">
        <g class="cloud">
          <ellipse cx="170" cy="90" rx="52" ry="28" />
          <ellipse cx="216" cy="80" rx="40" ry="32" />
          <ellipse cx="124" cy="98" rx="32" ry="20" />
        </g>
        <g class="cloud c2">
          <ellipse cx="520" cy="58" rx="44" ry="23" />
          <ellipse cx="560" cy="50" rx="32" ry="26" />
          <ellipse cx="484" cy="64" rx="26" ry="16" />
        </g>
        <g class="cloud c3" opacity=".85">
          <ellipse cx="700" cy="186" rx="35" ry="19" />
          <ellipse cx="730" cy="180" rx="24" ry="20" />
        </g>
      </g>

      <!-- 飞鸟 -->
      <g
        stroke="#8fa9b8"
        stroke-width="3.4"
        fill="none"
        stroke-linecap="round"
        opacity=".65"
      >
        <g class="bird">
          <g class="wing"><path d="M0 0 q11 -12 22 0 q11 -12 22 0" /></g>
        </g>
        <g class="bird b2" opacity=".8">
          <g class="wing"><path d="M0 0 q8 -9 16 0 q8 -9 16 0" /></g>
        </g>
      </g>

      <!-- 彩虹：淡彩圆弧，挂在天空一角 -->
      <g class="rainbow" opacity=".5">
        <path
          d="M120 320 A 180 180 0 0 1 480 320"
          fill="none"
          stroke="#ff7b7b"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M132 320 A 168 168 0 0 1 468 320"
          fill="none"
          stroke="#ffb35c"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M144 320 A 156 156 0 0 1 456 320"
          fill="none"
          stroke="#ffd95c"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M156 320 A 144 144 0 0 1 444 320"
          fill="none"
          stroke="#7bd88f"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M168 320 A 132 132 0 0 1 432 320"
          fill="none"
          stroke="#6fb6e8"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M180 320 A 120 120 0 0 1 420 320"
          fill="none"
          stroke="#b18ce0"
          stroke-width="10"
          stroke-linecap="round"
        />
      </g>

      <!-- 气泡：从海面升起、闪烁 -->
      <g class="bubbles" fill="none" stroke="#cfeefb" stroke-width="2.5">
        <circle class="bubble" cx="180" cy="520" r="9" />
        <circle class="bubble b2" cx="620" cy="500" r="12" />
        <circle class="bubble b3" cx="820" cy="540" r="7" />
        <circle class="bubble b4" cx="340" cy="580" r="10" />
      </g>

      <!-- 流星雨：偶尔划过天空 -->
      <g class="meteors" stroke-linecap="round">
        <path
          class="meteor"
          d="M820 -20 L740 60"
          stroke="#fff6c9"
          stroke-width="4"
        />
        <path
          class="meteor m2"
          d="M950 -40 L890 20"
          stroke="#fff6c9"
          stroke-width="3"
        />
      </g>

      <!-- 远山：三层空气透视，近深远淡 -->
      <path
        d="M0 358 C 96 288 190 280 274 330 C 352 280 448 288 522 334 C 606 280 712 288 792 334 C 872 296 940 308 1000 342 L1000 414 L0 414Z"
        fill="#a8c8d6"
        opacity=".55"
      />
      <path
        d="M0 392 C 112 344 214 344 302 378 C 400 340 520 346 608 382 C 716 344 848 350 1000 384 L1000 434 L0 434Z"
        fill="#86b6c9"
        opacity=".7"
      />
      <path
        d="M0 424 C 96 392 200 392 296 416 C 392 386 520 392 620 418 C 716 392 848 396 1000 420 L1000 448 L0 448Z"
        fill="#6fa3ba"
        opacity=".8"
      />

      <!-- 海 -->
      <rect y="406" width="1000" height="254" fill="url(#seaA)" />
      <rect
        class="sea-shimmer"
        y="424"
        width="1000"
        height="26"
        fill="#fff9e8"
        opacity=".4"
        filter="url(#blurB)"
      />
      <rect
        class="sparkle"
        x="150"
        y="470"
        width="90"
        height="7"
        rx="3.5"
        fill="#ffffff"
        opacity=".5"
      />
      <rect
        class="sparkle"
        x="700"
        y="504"
        width="70"
        height="6"
        rx="3"
        fill="#ffffff"
        opacity=".45"
        style="animation-delay: -1.4s"
      />
      <rect
        class="sparkle"
        x="380"
        y="556"
        width="60"
        height="5"
        rx="2.5"
        fill="#ffffff"
        opacity=".4"
        style="animation-delay: -2.2s"
      />
      <g
        stroke="#ffffff"
        stroke-width="4"
        stroke-linecap="round"
        opacity=".5"
        fill="none"
      >
        <path class="wave" d="M46 622 q26 -13 52 0 q26 13 52 0" />
        <path class="wave w2" d="M712 634 q26 -13 52 0 q26 13 52 0" />
        <path class="wave w3" d="M292 648 q26 -13 52 0 q26 13 52 0" />
      </g>

      <!-- 9 个地点 = 9 座微型小岛，由坐标表驱动，见 data/island-spots.ts -->
      <KidSpot
        v-for="(spot, index) in spots"
        :key="spot.key"
        :index="index"
        :label="$t(`kid.modules.${spot.key}`)"
        :spot="spot"
        @select="flyTo(spot)"
      />

      <!-- 粉色小猪：飞行吉祥物，点菜单时飞过去，自身不响应点击 -->
      <g ref="pigEl" class="pig-flyer" aria-hidden="true">
        <!-- 游泳姿态层：整片海漫游由外层 pigEl 沿 SWIM_PATH 循环；
             这里只做身体的轻微起伏 + 摇摆，飞行时停止并复位 -->
        <g ref="swimEl">
          <!-- 水面投影 -->
          <ellipse cx="0" cy="10" rx="30" ry="8" fill="#2e6e8a" opacity=".25" />
          <g class="pig-bounce">
            <g class="pig-ear-l">
              <path
                d="M-28 -22 L-16 -38 L-8 -24 Z"
                fill="#f7b6c4"
                stroke="#4a3f35"
                stroke-width="4.6"
                stroke-linejoin="round"
              />
            </g>
            <g class="pig-ear-r">
              <path
                d="M28 -22 L16 -38 L8 -24 Z"
                fill="#f7b6c4"
                stroke="#4a3f35"
                stroke-width="4.6"
                stroke-linejoin="round"
              />
            </g>
            <g class="pig-body">
              <circle
                cx="0"
                cy="-2"
                r="36"
                fill="#f8c6d2"
                stroke="#4a3f35"
                stroke-width="4.8"
              />
              <g class="pig-eye">
                <circle cx="-12" cy="-11" r="4.2" fill="#4a3f35" />
              </g>
              <g class="pig-eye">
                <circle cx="12" cy="-11" r="4.2" fill="#4a3f35" />
              </g>
              <ellipse
                cx="0"
                cy="4"
                rx="11"
                ry="8.5"
                fill="#f2a4b6"
                stroke="#4a3f35"
                stroke-width="4"
              />
              <ellipse cx="-4" cy="4" rx="2" ry="2.8" fill="#4a3f35" />
              <ellipse cx="4" cy="4" rx="2" ry="2.8" fill="#4a3f35" />
              <path
                d="M-8 16 q8 7 16 0"
                stroke="#4a3f35"
                stroke-width="3.8"
                fill="none"
                stroke-linecap="round"
              />
            </g>
            <path
              class="pig-tail"
              d="M34 12 q14 -2 8 -12 q-3 -7 -12 -2"
              stroke="#4a3f35"
              stroke-width="4.4"
              fill="none"
              stroke-linecap="round"
            />
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
/* ===== 竖屏留白补的天空 =====
 * 只出现在 fit === 'meet'（竖屏）时：svg 贴底、上方空出来的部分。
 * 末端必须是 skyA 的 0% stop（#9bd6ff），否则与场景天空顶部之间会出现一道色带。
 */
.island-sky {
  background: linear-gradient(180deg, #74b9ee 0%, #8bcbf6 55%, #9bd6ff 100%);
}

/* ===== 轻微跟随视角：只用 rotateY 左右微摆，不用 perspective/rotateX =====
 * perspective + rotateX 会让竖构图的正视风景画「向后仰倒」，岛看起来像竖起来。
 * 这里不设 perspective、不设 preserve-3d，仅保留 rotateY 的水平微摆（安全、无透视变形）。
 */
.island-tilt {
  transition: transform 0.3s ease-out;
  will-change: transform;
}

/* ===== 环境层：常驻、极慢、周期全部错开 =====
 * 同类元素不用同周期同延迟 —— 整屏一起动会变成机械感，也会抢走注意力。
 * 所有动画只碰 transform / opacity（走合成器，不触发重排）。
 */
.cloud {
  animation: drift 78s ease-in-out infinite alternate;
}

.cloud.c2 {
  animation-duration: 96s;
  animation-delay: -22s;
}

.cloud.c3 {
  animation-duration: 64s;
  animation-delay: -40s;
}

@keyframes drift {
  from {
    transform: translateX(-30px);
  }

  to {
    transform: translateX(34px);
  }
}

.sun-halo {
  transform-origin: center;
  transform-box: fill-box;
  animation: halo 5.5s ease-in-out infinite;
}

@keyframes halo {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.11);
  }
}

.rays {
  transform-origin: center;
  transform-box: fill-box;
  animation: spin 60s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.bird {
  animation: fly 34s linear infinite;
}

.bird.b2 {
  animation-duration: 44s;
  animation-delay: -16s;
}

@keyframes fly {
  from {
    transform: translate(-140px, 10px);
  }

  to {
    transform: translate(1140px, -56px);
  }
}

.wing {
  transform-origin: center;
  transform-box: fill-box;
  animation: flap 0.62s ease-in-out infinite alternate;
}

@keyframes flap {
  from {
    transform: scaleY(1);
  }

  to {
    transform: scaleY(0.35);
  }
}

.sea-shimmer {
  animation: shimmer 11s ease-in-out infinite alternate;
}

@keyframes shimmer {
  from {
    opacity: 0.28;
    transform: translateX(-16px);
  }

  to {
    opacity: 0.55;
    transform: translateX(16px);
  }
}

.wave {
  animation: wavemove 9s ease-in-out infinite alternate;
}

.wave.w2 {
  animation-duration: 12s;
  animation-delay: -3s;
}

.wave.w3 {
  animation-duration: 7.5s;
  animation-delay: -6s;
}

@keyframes wavemove {
  from {
    transform: translateX(-14px);
  }

  to {
    transform: translateX(18px);
  }
}

.sparkle {
  transform-origin: center;
  transform-box: fill-box;
  animation: sparkle 3.2s ease-in-out infinite;
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.5);
  }

  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

/* ===== 进场：整座岛淡入 + 轻微放大，只播一次（挂在 stage 层，不与 tilt 的 transform 抢） ===== */
.island-enter {
  animation: island-enter 0.9s ease-out both;
}

@keyframes island-enter {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(12px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ===== 彩虹：淡入淡出 + 轻微起伏 ===== */
.rainbow {
  transform-origin: center;
  transform-box: fill-box;
  animation: rainbow-breathe 7s ease-in-out infinite;
}

@keyframes rainbow-breathe {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  50% {
    opacity: 0.6;
    transform: translateY(-4px);
  }
}

/* ===== 气泡：从海面升起，越升越淡 ===== */
.bubble {
  transform-origin: center;
  transform-box: fill-box;
  animation: bubble-rise 6s ease-in infinite;
}

.bubble.b2 {
  animation-duration: 7.4s;
  animation-delay: -1.6s;
}

.bubble.b3 {
  animation-duration: 5.2s;
  animation-delay: -3s;
}

.bubble.b4 {
  animation-duration: 8s;
  animation-delay: -4.4s;
}

@keyframes bubble-rise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.4);
  }

  12% {
    opacity: 0.85;
  }

  100% {
    opacity: 0;
    transform: translateY(-180px) scale(1.1);
  }
}

/* ===== 流星雨：偶尔划过 ===== */
.meteor {
  opacity: 0;
  transform-origin: center;
  transform-box: fill-box;
  animation: meteor-shoot 11s ease-in infinite;
}

.meteor.m2 {
  animation-duration: 13s;
  animation-delay: -6s;
}

@keyframes meteor-shoot {
  0%,
  100% {
    opacity: 0;
    transform: translate(0, 0);
  }

  4% {
    opacity: 0.95;
  }

  12% {
    opacity: 0;
    transform: translate(-120px, 110px);
  }
}

/* ===== 粉色小猪飞行吉祥物 =====
 * 位置与飞行位移完全交给 GSAP（见 script 的 gsap.set / flyPig timeline），
 * 这里不写任何 transform / transform-box / transform-origin，否则会与
 * GSAP 写入 SVG transform 属性互相覆盖。CSS 只管内层的表情小动画。
 */
.pig-bounce {
  transform-origin: center bottom;
  transform-box: fill-box;
  animation: pig-bounce 3.4s ease-in-out infinite;
}

@keyframes pig-bounce {
  0%,
  100% {
    transform: translateY(0) scaleY(1);
  }

  50% {
    transform: translateY(-6px) scaleY(1.02);
  }
}

.pig-eye {
  transform-origin: center;
  transform-box: fill-box;
  animation: pig-blink 4.6s ease-in-out infinite;
}

@keyframes pig-blink {
  0%,
  93%,
  100% {
    transform: scaleY(1);
  }

  96% {
    transform: scaleY(0.08);
  }
}

.pig-ear-l {
  transform-origin: bottom center;
  transform-box: fill-box;
  animation: pig-ear 5.2s ease-in-out infinite;
}

.pig-ear-r {
  transform-origin: bottom center;
  transform-box: fill-box;
  animation: pig-ear 5.2s ease-in-out infinite;
  animation-delay: -2.6s;
}

@keyframes pig-ear {
  0%,
  92%,
  100% {
    transform: rotate(0deg);
  }

  96% {
    transform: rotate(6deg);
  }
}

.pig-tail {
  transform-origin: 34px 12px;
  transform-box: fill-box;
  animation: pig-tail-wag 2.8s ease-in-out infinite;
}

@keyframes pig-tail-wag {
  0%,
  100% {
    transform: rotate(0deg);
  }

  50% {
    transform: rotate(22deg);
  }
}

/* ===== 地点：入场弹出 + 常驻呼吸 =====
 * 两层分开，避免与 KidSpot 内部的悬停位移抢同一个 transform。
 * :deep() 是因为 .pop / .bob 在子组件 KidSpot 的模板里。
 */
:deep(.pop) {
  transform-origin: center bottom;
  transform-box: fill-box;
  animation: pop 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: var(--d, 0s);
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.3) translateY(12px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

:deep(.bob) {
  animation: bob 3.8s ease-in-out infinite;
  animation-delay: var(--d, 0s);
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

/* ===== 无障碍：系统开了「减少动态效果」就把循环动画全部停掉 =====
 * 不是可选项 —— 主要使用场景是低端平板，满屏动画会直接掉帧。
 */
@media (prefers-reduced-motion: reduce) {
  .cloud,
  .sun-halo,
  .rays,
  .bird,
  .wing,
  .sea-shimmer,
  .wave,
  .sparkle,
  .island-enter,
  .rainbow,
  .bubble,
  .meteor,
  .pig-bounce,
  .pig-eye,
  .pig-ear-l,
  .pig-ear-r,
  .pig-tail {
    animation: none !important;
  }

  :deep(.pop),
  :deep(.bob) {
    animation: none !important;
  }
}
</style>
