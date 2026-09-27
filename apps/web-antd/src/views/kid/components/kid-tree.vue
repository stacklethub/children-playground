<script setup lang="ts">
/**
 * 竖屏首页：一棵**圣诞树**，7 个模块做成木牌挂在各层树冠的下摆，树顶是「我的星星」。
 *
 * ## 木牌顺序：自下而上
 *
 * 最下层挂第一个模块（看图识物），最上层挂最后一个（闯关冒险），
 * 详见 `data/island-spots.ts` 的 `TREE_BRANCHES`。
 *
 * ## 造型：分层针叶塔
 *
 * 树 = 4 层「上尖 + 两侧微外凸斜边 + **波浪形下摆**」的独立形状，层与层重叠
 * 约 40~50 个单位。三个细节决定它「像圣诞树」而不是「像交通锥」：
 *
 * 1. **下摆是波浪（`Q` 小弧串）而不是直线** —— 模拟针叶垂枝。
 * 2. **侧边微微外凸**（`Q` 控制点向外偏 22）—— 直斜边是锥形，外凸才有蓬松感。
 * 3. **层次靠重叠 + 下摆的明暗差**体现，而不是靠硬描边 —— 早期版本给每层加
 *    `stroke` 深绿描边，结果层与层之间是一道道生硬的斜线，像把三角形叠起来。
 *
 * ## 自适应：contain 缩放（**必须覆盖全树**）
 *
 * 先量舞台尺寸，再算一个刚好装下**整棵树**的缩放比
 * （`min(w/场景框宽, h/场景框高)`，即 contain 语义），把结果写进 CSS 变量。
 * 缩放基准是 `TREE_SCENE_BOX` —— 它必须**覆盖全树**（树顶星星上沿到树干底），
 * 否则会「树高度溢出」：早期只按木牌定位框，漏了星星与树干，比例算大后整棵树
 * 纵向溢出视口。详见 `data/island-spots.ts` 的 `TREE_SCENE_BOX` 注释。
 *
 * ## 坐标契约
 *
 * 木牌位置在 `data/island-spots.ts` 的 `TREE_BRANCHES`（含挂点 anchor 与
 * `tierScale`），下面 `TIERS` 是 4 层的轮廓。**改轮廓必须同步改 anchor**。
 *
 * ## 热区
 *
 * 点击不在本层接 —— 本层是 `pointer-events: none`，纯展示。接点击的是叠在上面
 * 的 `kid-tree-hotspots.vue`，它用同一套 `--tree-*` 变量做同样的变换。
 * 热区层 `emit('select')` → `home/index.vue` 调到本组件的 `diveInto`（见下）。
 */
import type { TileKey } from '#/data/modules';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

import {
  TREE_REWARD,
  TREE_SCENE_BOX,
  TREE_VIEWBOX,
  treeBranchesFor,
} from '#/data/island-spots';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import KidPlank from './kid-plank.vue';

gsap.registerPlugin(MotionPathPlugin);

const router = useRouter();
const kidStore = useKidStore();

/**
 * 小猪是点击演出的主角，但**接点击的层不是本层** —— 本层是 `pointer-events: none`
 * 的纯展示层（见模板注释），接点击的是叠在上面的 `kid-tree-hotspots.vue`。
 * 所以由 `home/index.vue` 在中间转一手：热区层 `select` → 父组件调用本组件的
 * `diveInto`（通过 ref）→ 小猪飞过去并缩小 → 落地后才 `router.push`。
 *
 * 与岛场景（kid-island.vue）的差别：岛是「场景层自己接点击」（KidSpot 在场景
 * 层里），树是「热区层接点击」（因为木牌尺寸与热区尺寸不同，见 hotspots 注释）。
 * 所以这里用 `defineExpose` 把演出方法暴露出去，而不是 emit。
 */
defineExpose({ diveInto });

/** 木牌 key → 路由 name。与 kid-tree-hotspots.vue 的同名表一致 */
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

/** 家长关掉的模块不出现在树上 */
const branches = computed(() =>
  treeBranchesFor((key) => kidStore.moduleEnabled(key)),
);

/**
 * 4 层针叶。每层是独立闭合路径：顶点 → 右侧外凸下探 → 右端 → 波浪下摆（右→左）
 * → 左端 → 左侧外凸回顶点。
 *
 * 三个细节决定它「像圣诞树」而不是「像交通锥」，缺一不可：
 *
 * 1. **下摆是波浪**（一串 `Q` 小弧向下鼓 17）—— 针叶垂枝；直线边一眼就是几何体。
 * 2. **侧边外凸**（`Q` 控制点向外偏 22）—— 直斜边是锥形，外凸才有蓬松的针叶感。
 * 3. **层与层不描边、只靠重叠与下摆的暗部区分** —— 早期给每层加 `stroke` 深绿
 *    描边，结果层间是一道道生硬斜线，像把三角形叠起来。现在层只填色、只有最外层
 *    下摆有轻微暗影。
 *
 * 层级几何（画布坐标，中轴 x=260）：
 * | 层 | 尖顶 y | 下摆 y | 底半宽 | 下摆弧数 | 木牌挂点 y |
 * | -- | ------ | ------ | ------ | -------- | ---------- |
 * | 1  | 120    | 306    | 100    | 4        | 306        |
 * | 2  | 262    | 452    | 134    | 5        | 452        |
 * | 3  | 400    | 596    | 166    | 6        | 596        |
 * | 4  | 534    | 718    | 198    | 7        | 718        |
 *
 * 每层尖顶落在上一层下摆之上约 40~50，形成「压住一层」的重叠，不露缝隙，
 * 同时每层的外沿都比上层宽约 34，形成明显的阶梯。
 *
 * ⚠️ **收窄过的比例**：上面这组 `half`（100/134/166/198）是刻意把树冠横向
 * 收窄的结果 —— 早期是 112/150/188/226（最宽 452），比手机竖屏更「胖」，
 * contain 之后纵向只用到 81%，树显得悬在中间没长满。收窄后最宽 396，
 * 与手机竖屏比例（≈0.46）匹配，纵向利用率升到 ≈91%。
 * **改这里的 `half` 必须同步改 `TREE_SCENE_BOX`（见 island-spots.ts）。**
 *
 * ⚠️ `bottom` / `half` 与 TREE_BRANCHES 里对应 anchor 的 `y`、可挂点范围是
 * **成对契约**，改这里必须同步改 island-spots.ts。
 */
const TIERS = [
  {
    bottom: 306,
    d: 'M260 120 Q 378 213 360 306 Q 335 320 310 306 Q 285 320 260 306 Q 235 320 210 306 Q 185 320 160 306 Q 142 213 260 120 Z',
    half: 100,
    top: 120,
  },
  {
    bottom: 452,
    d: 'M260 262 Q 414 357 394 452 Q 367 467 340 452 Q 314 467 287 452 Q 260 467 233 452 Q 206 467 180 452 Q 153 467 126 452 Q 106 357 260 262 Z',
    half: 134,
    top: 262,
  },
  {
    bottom: 596,
    d: 'M260 400 Q 447 498 426 596 Q 398 612 371 596 Q 343 612 315 596 Q 288 612 260 596 Q 232 612 205 596 Q 177 612 149 596 Q 122 612 94 596 Q 73 498 260 400 Z',
    half: 166,
    top: 400,
  },
  {
    bottom: 718,
    d: 'M260 534 Q 480 626 458 718 Q 430 736 401 718 Q 373 736 345 718 Q 317 736 288 718 Q 260 736 232 718 Q 203 736 175 718 Q 147 736 119 718 Q 90 736 62 718 Q 40 626 260 534 Z',
    half: 198,
    top: 534,
  },
] as const;

/**
 * 受光面：贴在每层左半边的一小片亮色，与岛场景同一光源方向（左上）。
 * 形状跟着该层的左斜边走，所以看上去是「这一层被光照到的部分」。
 */
const TIER_LIGHTS = [
  'M260 150 Q 306 216 324 296 Q 292 306 260 296 Z',
  'M260 292 Q 322 372 358 444 Q 309 454 260 444 Z',
  'M260 430 Q 336 518 384 588 Q 322 600 260 588 Z',
  'M260 566 Q 352 654 408 710 Q 334 726 260 710 Z',
] as const;

/**
 * 树干：只在下半截露出来（上半被针叶盖住）。底部外扩成根盘，戳进雪地。
 */
const TRUNK_PATH = `M243 606 C 240 672, 236 744, 226 812 C 220 850, 212 874, 202 892
   L 322 892 C 310 874, 302 850, 296 812 C 286 744, 282 672, 279 606 Z`;

/**
 * 树上的小灯：缀在每层下摆的凹处，缓慢明灭。
 * 位置对齐各层下摆的弧谷（见 TIERS 的波浪控制点），所以看起来灯是「挂」在针叶上的。
 */
const LIGHTS = [
  { delay: 0, r: 5, x: 260, y: 318 },
  { delay: -0.9, r: 5, x: 210, y: 318 },
  { delay: -0.45, r: 5, x: 310, y: 318 },
  { delay: -1.35, r: 5, x: 160, y: 318 },
  { delay: -0.7, r: 5, x: 233, y: 464 },
  { delay: -1.6, r: 6, x: 287, y: 464 },
  { delay: -0.25, r: 5, x: 180, y: 464 },
  { delay: -1.15, r: 5, x: 340, y: 464 },
  { delay: -2.05, r: 5, x: 126, y: 464 },
  { delay: -0.5, r: 5, x: 205, y: 608 },
  { delay: -1.4, r: 6, x: 260, y: 608 },
  { delay: -0.95, r: 5, x: 315, y: 608 },
  { delay: -1.85, r: 5, x: 371, y: 608 },
  { delay: -2.3, r: 5, x: 149, y: 608 },
  { delay: -0.35, r: 5, x: 94, y: 608 },
  { delay: -1.1, r: 5, x: 175, y: 730 },
  { delay: -0.65, r: 6, x: 232, y: 730 },
  { delay: -1.5, r: 5, x: 288, y: 730 },
  { delay: -2.4, r: 5, x: 345, y: 730 },
  { delay: -0.9, r: 5, x: 401, y: 730 },
] as const;

/**
 * 落雪：缓缓飘落 + 横向小幅游移。覆盖整个画布，让树「在雪里」。
 */
const SNOWFLAKES = [
  { delay: 0, r: 4, x: 62, y: 120 },
  { delay: -2.4, r: 5, x: 148, y: 60 },
  { delay: -4.8, r: 3.5, x: 226, y: 150 },
  { delay: -1.2, r: 4, x: 306, y: 96 },
  { delay: -3.6, r: 5, x: 386, y: 176 },
  { delay: -5.4, r: 3.5, x: 452, y: 108 },
  { delay: -2, r: 4, x: 106, y: 340 },
  { delay: -4.2, r: 4.5, x: 404, y: 384 },
  { delay: -1.8, r: 3.5, x: 180, y: 520 },
  { delay: -3.2, r: 4, x: 340, y: 556 },
  { delay: -5, r: 4.5, x: 90, y: 780 },
  { delay: -2.8, r: 4, x: 430, y: 812 },
] as const;

/**
 * 3D 轻微跟随视角：与岛场景同一手法 —— 只做 rotateY 的极小幅度，
 * **刻意不用 perspective + rotateX**（那会把平视构图压成俯视）。
 */
const sway = ref(0);
function onPointerMove(event: PointerEvent) {
  sway.value = (event.clientX / window.innerWidth) * 2 - 1;
}

/**
 * 粉色小猪：树的吉祥物。
 *
 * ## 两个阶段
 *
 * 1. **游荡**（默认）：只在**树脚下的雪地上**来回走（`PIG_PATROL`），不爬树 ——
 *    树冠是「入口区」，猪在那里晃会挡住木牌、也会让人以为它想爬上去。
 * 2. **钻牌**（点木牌时）：停下游荡，沿一条「拱形」路径飞到被点的木牌。
 *    缩水分两段（见 `diveInto`）：飞行途中只**小幅缩小**（保持看得清），
 *    真正「缩进牌子」是**最后 0.34s 的俯冲**——孩子看到的是「猪一路飞到牌子
 *    跟前，然后一头钻进去不见了」，而不是「飞一半就消失了」（用户明确要求）。
 *
 * ## 为什么从 `<animateMotion>` 换成 GSAP
 *
 * 早期用原生 `<animateMotion>` 驱动游荡，好处是「声明式、零依赖」。但要做
 * 「飞行 + 缩放 + 停顿 + 跳转」这套可编排的演出，`<animateMotion>` 做不到：
 * SMIL 没有时间轴串联能力，缩放要另外挂一条 `<animate>`，两条动画的 `begin`
 * 对齐、以及「飞行结束后才跳转」都要靠 `beginEvent` 监听硬凑 —— 比直接用
 * GSAP 时间轴复杂得多，还容易在交互快速连点时错乱。
 *
 * 岛场景（kid-island.vue）早就用 GSAP + MotionPathPlugin 做同一件事，树这里
 * 与它统一，两套场景的小猪行为也一致（点入口 → 猪飞过去 → 进模块）。
 *
 * ⚠️ 与岛场景同样的原因不能用 CSS `translate(px)`：那在 SVG 里是**屏幕像素**，
 * 会把猪甩出画面。GSAP 写的是 SVG 的 `transform` 属性（viewBox 无单位坐标），
 * 才是对的坐标系。
 */

/**
 * 小猪在**树脚下雪地**来回走的路线（画布坐标）。在树干基部左右两侧的小范围内
 * 横向往返，像一个在树根边溜达的小动物。
 *
 * 三个约束：
 * - **不越过第 4 层树冠的下摆**：第 4 层下摆 y=718、半宽 198，所以路线整体
 *   留在 y ≥ 800（在下摆之下很远处），树冠不会挡住它。
 * - **踩在雪面上**：雪地起伏在 y≈856（中间最低点 852~856），树干基部在
 *   y=892。所以猪中心取 y 838~862 —— 身体下缘 ≈862+31=893，正好「站在雪上」。
 * - **必须落在 `TREE_SCENE_BOX`（x 50~470、y 66~898）内并留出猪身半径 ≈ 36**：
 *   x 中央 ±160（100~420），100-36=64 ≥ 50、420+36=456 ≤ 470；
 *   y 最高 838、最低 862，862+36=898 正好抵住框底。
 *
 * 横向跨度 ±160 让猪从树干左走到树干右（树干基部半宽 ≈60），绕过树干 ——
 * 只在小范围原地打转看起来会像「卡住了」。
 *
 * 形状是一个**扁椭圆**：末端用 `C` 平滑闭合，避免出现「走到头突然掉头」的
 * 生硬感（`ease: 'none'` 匀速跑，靠路径的圆角完成转身）。
 */
const PIG_PATROL =
  'M 100 850 C 100 826, 150 818, 260 818 C 370 818, 420 826, 420 850 ' +
  'C 420 872, 370 880, 260 880 C 150 880, 100 872, 100 850 Z';

/** 小猪来回溜达一圈的时长（秒）—— 慢悠悠的，太快会让 3-5 岁看着心慌 */
const PIG_PATROL_DURATION = 24;

/** 游荡时的基准缩放（`TREE_VIEWBOX` 里猪身半径 36，乘它后 ≈ 31） */
const PIG_WANDER_SCALE = 0.86;

/**
 * 飞行途中缩到的比例（**还在空中、还没到牌子**时的中途最小值）。
 *
 * 刻意保持在 0.62 —— 仍是清晰可辨的一只猪。早期把整段飞行都缩到 0.06，
 * 结果「还没飞到就看不见了」（用户反馈）。现在飞行段只小幅缩小（引出
 * 纵深感），真正的消失交给最后那一下俯冲（`PIG_DIVE_SCALE`）。
 */
const PIG_FLIGHT_SCALE = 0.62;

/**
 * 俯冲钻进木牌时缩到的比例 —— 近乎一个点。
 * 不给 0：完全消失会让人以为「猪没了」，「缩到很小」才读得出「钻进去了」。
 */
const PIG_DIVE_SCALE = 0.08;

/** 小猪的 `<g>` 元素引用，GSAP 直接驱动它的 x / y / scale */
const pigEl = ref<null | SVGGElement>(null);

/** 内层「起伏」组：游荡时上下浮动 + 摆尾；飞行时复位 */
const pigBobEl = ref<null | SVGGElement>(null);

/** 飞行中：拦住重复点击（一只猪不能同时飞两处） */
const isFlying = ref(false);

/**
 * 系统开了「减少动态效果」时，小猪**不溜达**（只静止停在树下）。
 *
 * 为什么在 JS 里判断而不是只用 CSS：猪的运动由 GSAP 驱动（JS 写 SVG 属性），
 * CSS 的 `@media (prefers-reduced-motion)` 拦不住它。飞行演出仍然保留 ——
 * 那是「点击后的必要反馈」，停掉会让孩子以为没点中。
 */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 游荡相关 tween（漫游 + 姿态），飞行前全部 kill */
let wanderTweens: gsap.core.Tween[] = [];

/**
 * 开始溜达：外层沿 `PIG_PATROL` 在树脚下匀速往返（`ease: 'none'`），
 * 内层做轻微起伏，让身体有韵律感。两层各管各的，互不干扰。
 */
function startWandering() {
  if (prefersReducedMotion) return;

  const pig = pigEl.value;
  const bob = pigBobEl.value;
  if (!pig || !bob) return;

  wanderTweens = [
    gsap.to(pig, {
      motionPath: { autoRotate: false, path: PIG_PATROL },
      duration: PIG_PATROL_DURATION,
      ease: 'none',
      repeat: -1,
    }),
    gsap.to(bob, {
      duration: 1.6,
      ease: 'sine.inOut',
      repeat: -1,
      rotation: 2,
      yoyo: true,
      y: 3,
    }),
  ];
}

/** 停下游荡：kill 后猪停在当前位置，作为飞行起点；内层姿态复位 */
function stopWandering() {
  for (const tween of wanderTweens) tween.kill();
  wanderTweens = [];
  if (pigBobEl.value) gsap.set(pigBobEl.value, { rotation: 0, y: 0 });
}

/**
 * 点木牌 → 小猪飞到那块牌子跟前，再**一头钻进去**，然后跳转模块。
 *
 * 本方法由 `home/index.vue` 经 `defineExpose` 调用（热区层接点击 → 父组件转手，
 * 理由见 script 顶部 defineExpose 的注释）。
 *
 * ## 缩水分两段（用户明确要求「不能还没飞到就不见了」）
 *
 * 1. **飞行段**（1.6s）：拱形飞到木牌中心，同时从当前比例缩到 `PIG_FLIGHT_SCALE`
 *    （0.62）—— 仍是清楚的一只猪，只是略小，用来表达「飞远了」。
 * 2. **俯冲段**（0.34s）：在原地（木牌中心）从 0.62 缩到 `PIG_DIVE_SCALE`（0.08），
 *    给一点点「往牌子里怼」的位移。这一段才是「钻进牌子」的那一下。
 *
 * 拆成两段而不是一段线性缩小，是因为一段式会让「缩小」这件事在飞行前半程就
 * 完成大半 —— 孩子看到的是「猪飞到一半就没了」。两段式把「消失」压缩到
 * 最后 0.34s，且**只在牌子跟前发生**，才读得出「钻进去」。
 *
 * @param target 目标木牌（含 key 与画布坐标，直接传 `TREE_BRANCHES` 的条目）
 */
function diveInto(target: { key: TileKey; x: number; y: number }) {
  if (isFlying.value) return;
  const el = pigEl.value;
  if (!el) return;

  isFlying.value = true;
  stopWandering();
  // 先出声再跳转：3-5 岁靠语音确认「我点到了什么」
  speak($t(`kid.modules.${target.key}`));

  // 当前位置（GSAP 记忆的 viewBox 坐标）作为飞行起点
  const startX = gsap.getProperty(el, 'x') as number;
  const startY = gsap.getProperty(el, 'y') as number;

  /*
    拱顶高度：树里没有「天空」可借，所以拱顶只抬到比起点与终点都高 ~110 的
    位置（近似兽类跃起的抛物线），既显得是「跳过去」而不是贴着树皮平移，
    又不会冲到树顶星星那里抢视线。
  */
  const arcTop = Math.min(startY, target.y) - 110;
  const dx = target.x - startX;
  const flightPath = `M ${startX} ${startY} C ${startX + dx * 0.25} ${arcTop}, ${target.x - dx * 0.25} ${arcTop}, ${target.x} ${target.y}`;

  gsap
    .timeline({
      onComplete: () => {
        isFlying.value = false;
        // 俯冲（钻进去）后才真正跳转，让「钻」这个动作被看见
        router.push({ name: ROUTE_NAME[target.key] });
      },
    })
    // 1) 拱形飞行：飞到木牌中心，同时小幅缩小（仍清楚可辨，只是「飞远了」）
    .to(el, {
      duration: 1.6,
      ease: 'sine.inOut',
      motionPath: { autoRotate: false, path: flightPath },
      scale: PIG_FLIGHT_SCALE,
    })
    // 2) 俯冲钻进木牌：短促、就地缩小，把「消失」压到牌子跟前
    .to(el, {
      duration: 0.34,
      ease: 'power2.in',
      scale: PIG_DIVE_SCALE,
      // 往牌子里再怼一点点，强化「钻」的方向感（牌子在树冠上，方向朝内上方）
      x: target.x + (target.x < 260 ? 10 : -10),
      y: target.y - 8,
    });
}

/**
 * 自适应缩放：按舞台尺寸算出「刚好装下 TREE_SCENE_BOX」的等比缩放，
 * 通过 CSS 变量下发给本层与热区层。
 *
 * 为什么用 ResizeObserver 而不是 useElementSize：本项目已确认
 * `useElementSize` 首帧量到 0/0（会先渲染错形态），且更新时机不保证在 layout
 * 之后。ResizeObserver 在每次实际尺寸变化后触发，首帧就有可靠值。这里不依赖它
 * 做「形态判断」（形态由 home/index.vue 的 matchMedia 决定），只做纯尺寸换算，
 * 所以偶发的一帧滞后也只是树的大小差一点，不会闪形态。
 */
const stageWidth = ref(0);
const stageHeight = ref(0);

const scale = computed(() => {
  const w = stageWidth.value;
  const h = stageHeight.value;
  if (!w || !h) return 1;
  return Math.min(w / TREE_SCENE_BOX.width, h / TREE_SCENE_BOX.height);
});

/** 缩放后的绘制尺寸（CSS px），直接给 <svg> 用 */
const canvasWidth = computed(() => TREE_VIEWBOX.width * scale.value);
const canvasHeight = computed(() => TREE_VIEWBOX.height * scale.value);

const stageStyle = computed(() => ({
  '--tree-canvas-h': `${canvasHeight.value.toFixed(2)}px`,
  '--tree-canvas-w': `${canvasWidth.value.toFixed(2)}px`,
  '--tree-scale': scale.value.toFixed(5),
}));

let observer: null | ResizeObserver = null;

function measure(element: Element) {
  const rect = element.getBoundingClientRect();
  stageWidth.value = Math.round(rect.width);
  stageHeight.value = Math.round(rect.height);
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /*
    量的是 `document.documentElement` 而不是自己那个 `absolute inset-0` 的 div：
    本层被 `pointer-events: none` 保护、尺寸由父容器给，量它自己理论上也对，
    但量根元素能彻底断开「内容影响容器」的循环 —— 这个坑在形态判定上已经踩过
    一次（见 home/index.vue 的注释），尺寸换算上不必再冒险。
  */
  const root = document.documentElement;
  measure(root);
  observer = new ResizeObserver(() => measure(root));
  observer.observe(root);

  // 小猪：先落到溜达路线的起点（树脚下左端），随后开始来回溜达
  gsap.set(pigEl.value, { scale: PIG_WANDER_SCALE, x: 100, y: 850 });
  startWandering();
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  observer?.disconnect();
  observer = null;
  stopWandering();
  // 组件卸载时正在飞的 tween 也要杀，否则它会继续驱动已移除的节点（内存泄漏）
  gsap.killTweensOf(pigEl.value);
});
</script>

<template>
  <!--
    舞台：铺满、裁切溢出、纯展示。天空与雪地的底色画在 CSS 上（不只在 SVG 里），
    这样等比缩放后留出的空白由底色补上，整屏仍是完整的冬夜雪景。
  -->
  <div class="tree-stage absolute inset-0 overflow-hidden" :style="stageStyle">
    <svg
      class="tree-canvas"
      :viewBox="`0 0 ${TREE_VIEWBOX.width} ${TREE_VIEWBOX.height}`"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      :aria-label="$t('kid.app.name')"
    >
      <defs>
        <linearGradient id="treeTier" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stop-color="#3f9d55" />
          <stop offset="55%" stop-color="#2f8a48" />
          <stop offset="100%" stop-color="#1f6b36" />
        </linearGradient>
        <linearGradient id="treeTrunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#a5724a" />
          <stop offset="52%" stop-color="#8b5e38" />
          <stop offset="100%" stop-color="#6d472a" />
        </linearGradient>
        <linearGradient id="treeGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f4f9ff" />
          <stop offset="100%" stop-color="#ddeaf8" />
        </linearGradient>
        <radialGradient id="starHalo">
          <stop offset="0%" stop-color="#fff2c4" stop-opacity=".95" />
          <stop offset="100%" stop-color="#fff2c4" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="sunHalo">
          <stop offset="0%" stop-color="#ffe9a8" stop-opacity=".8" />
          <stop offset="100%" stop-color="#ffe9a8" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!--
        太阳：挂在左上角的暖黄圆 + 光晕 + 光芒。
        与岛场景同一个位置语汇（右上角是天上的光），树场景把「我的星星」占了
        顶部正中，所以太阳放左上，避免与星星抢视线。
      -->
      <g class="tree-sun">
        <circle cx="76" cy="86" fill="url(#sunHalo)" r="108" />
        <g
          class="tree-sun-rays"
          opacity=".42"
          stroke="#ffe08a"
          stroke-linecap="round"
          stroke-width="6"
        >
          <path
            d="M76 86 L76 -8 M76 86 L76 180 M76 86 L-8 86 M76 86 L160 86
               M76 86 L14 24 M76 86 L138 148 M76 86 L14 148 M76 86 L138 24"
          />
        </g>
        <circle
          cx="76"
          cy="86"
          fill="#ffd766"
          r="40"
          stroke="#f0a83c"
          stroke-width="3"
        />
      </g>

      <!-- 雪地 -->
      <path
        d="M0 856 C 90 830, 180 842, 260 852 C 340 842, 430 830, 520 856
           L 520 940 L 0 940 Z"
        fill="url(#treeGround)"
      />

      <!-- 树干：先画，被上面的针叶压住上半截 -->
      <path
        :d="TRUNK_PATH"
        fill="url(#treeTrunk)"
        stroke="#5f3f24"
        stroke-linejoin="round"
        stroke-width="5"
      />

      <!-- 4 层针叶：从最下层画起，让上层压住下层的尖顶 -->
      <g v-for="tier in [...TIERS].reverse()" :key="`tier-${tier.top}`">
        <path :d="tier.d" fill="url(#treeTier)" />
      </g>
      <!-- 受光面：左上亮，跟着各层左斜边 -->
      <g fill="#7fd28b" opacity=".5">
        <path
          v-for="(d, index) in TIER_LIGHTS"
          :key="`light-${index}`"
          :d="d"
        />
      </g>

      <!-- 小灯：缀在每层下摆凹处，缓慢明灭 -->
      <g>
        <circle
          v-for="(light, index) in LIGHTS"
          :key="`light-${index}`"
          class="tree-light"
          :cx="light.x"
          :cy="light.y"
          fill="#fff3b8"
          :r="light.r"
          :style="{ '--light-delay': `${light.delay}s` }"
        />
      </g>

      <!--
        木牌：只在这一层画（热区层不画，否则会重影，见 kid-tree-hotspots.vue）。
      -->
      <KidPlank
        v-for="(branch, index) in branches"
        :key="branch.key"
        :delay="index * 0.31"
        :label="$t(`kid.modules.${branch.key}`)"
        :tier-scale="branch.tierScale"
        :x="branch.x"
        :y="branch.y"
      />

      <!-- 树顶：我的星星（第 8 个入口，是「树顶星」不是木牌） -->
      <g :transform="`translate(${TREE_REWARD.x},${TREE_REWARD.y})`">
        <!-- 光晕：缓慢呼吸，把视线引向树顶 -->
        <circle class="glow" fill="url(#starHalo)" r="88" />
        <!-- 灯座：从树顶尖角接过来 -->
        <path
          d="M0 -50 L0 -12"
          fill="none"
          stroke="#8a6a4a"
          stroke-linecap="round"
          stroke-width="5"
        />
        <!-- 五角星：圣诞树顶星 -->
        <path
          class="reward-star"
          d="M0 -44 L13.1 -13.5 L46 -13.5 L19.4 6.5 L29.8 38 L0 17.6
             L-29.8 38 L-19.4 6.5 L-46 -13.5 L-13.1 -13.5 Z"
          fill="#ffd766"
          stroke="#e2a12f"
          stroke-linejoin="round"
          stroke-width="6"
        />
        <!-- 星星里的笑脸：对不识字的孩子，「奖励」要靠表情传达 -->
        <g fill="#7a4f2e">
          <circle cx="-11" cy="-8" r="3.6" />
          <circle cx="11" cy="-8" r="3.6" />
        </g>
        <path
          d="M-12 2 Q0 13 12 2"
          fill="none"
          stroke="#7a4f2e"
          stroke-linecap="round"
          stroke-width="4.5"
        />
      </g>

      <!-- 落雪：飘在树之前，盖住一部分针叶，才有「在雪中」的层次 -->
      <g fill="#ffffff" opacity=".9">
        <circle
          v-for="(snow, index) in SNOWFLAKES"
          :key="`snow-${index}`"
          class="snowflake"
          :cx="snow.x"
          :cy="snow.y"
          :r="snow.r"
          :style="{ '--snow-delay': `${snow.delay}s` }"
        />
      </g>

      <!--
        粉色小猪：树脚下的吉祥物。位置与缩放由 GSAP 驱动 ——
        未点击时在树下雪地上来回溜达（PIG_PATROL）；点木牌时拱形飞过去，
        最后在牌子跟前一头钻进去（见 script 的 startWandering / diveInto）。
        内层 pigBobEl 由 GSAP 做轻微起伏，让身体有韵律感。
      -->
      <g ref="pigEl" class="tree-pig" aria-hidden="true">
        <g ref="pigBobEl">
          <!-- 耳朵 -->
          <path
            d="M-28 -22 L-16 -38 L-8 -24 Z"
            fill="#f7b6c4"
            stroke="#4a3f35"
            stroke-linejoin="round"
            stroke-width="4.6"
          />
          <path
            d="M28 -22 L16 -38 L8 -24 Z"
            fill="#f7b6c4"
            stroke="#4a3f35"
            stroke-linejoin="round"
            stroke-width="4.6"
          />
          <!-- 身体 -->
          <circle
            cx="0"
            cy="-2"
            fill="#f8c6d2"
            r="36"
            stroke="#4a3f35"
            stroke-width="4.8"
          />
          <!-- 眼睛 -->
          <circle cx="-12" cy="-11" fill="#4a3f35" r="4.2" />
          <circle cx="12" cy="-11" fill="#4a3f35" r="4.2" />
          <!-- 猪鼻 -->
          <ellipse
            cx="0"
            cy="4"
            fill="#f2a4b6"
            rx="11"
            ry="8.5"
            stroke="#4a3f35"
            stroke-width="4"
          />
          <ellipse cx="-4" cy="4" fill="#4a3f35" rx="2" ry="2.8" />
          <ellipse cx="4" cy="4" fill="#4a3f35" rx="2" ry="2.8" />
          <!-- 嘴 -->
          <path
            d="M-8 16 q8 7 16 0"
            fill="none"
            stroke="#4a3f35"
            stroke-linecap="round"
            stroke-width="3.8"
          />
          <!-- 尾巴 -->
          <path
            class="pig-tail"
            d="M34 12 q14 -2 8 -12 q-3 -7 -12 -2"
            fill="none"
            stroke="#4a3f35"
            stroke-linecap="round"
            stroke-width="4.4"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
/*
  舞台底色：与 SVG 里的夜空/雪地衔接。等比缩放（contain）时舞台必然有留白，
  用渐变把留白补成夜空与雪地，整屏看起来仍是一幅完整的画 —— 这正是放弃
  slice 之后必须接住的那部分。
*/
.tree-stage {
  pointer-events: none;
  background: linear-gradient(
    180deg,
    #0d2c4d 0%,
    #144468 30%,
    #2d6b90 58%,
    #cfe2f5 84%,
    #e8f1fb 100%
  );
}

/*
  画布尺寸由脚本算好的 CSS 变量给出，配合 <svg> 默认的 xMidYMid meet ——
  整棵树永远完整可见、等比、居中。
*/
.tree-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: var(--tree-canvas-w, 520px);
  height: var(--tree-canvas-h, 940px);
  transform: translate(-50%, -50%)
    rotateY(v-bind('`${(sway * 1.4).toFixed(2)}deg`'));
}

.tree-light {
  transform-origin: center;
  transform-box: fill-box;
  animation: tree-twinkle 2.8s ease-in-out infinite;
  animation-delay: var(--light-delay, 0s);
}

/* 太阳：光芒缓慢自转，像真的在发光 */
.tree-sun-rays {
  transform-origin: center;
  transform-box: fill-box;
  animation: tree-sun-spin 40s linear infinite;
}

@keyframes tree-sun-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 小猪：位置 / 缩放 / 起伏全部交给 GSAP（见 script），
 * 这里**不能**写任何 transform / transform-box，否则会与 GSAP 写入的 SVG
 * 属性互相覆盖（本项目已踩过）。CSS 只管尾巴的摆动。 */
.pig-tail {
  transform-origin: 0 50%;
  transform-box: fill-box;
  animation: pig-tail-wag 0.9s ease-in-out infinite;
}

@keyframes pig-tail-wag {
  0%,
  100% {
    transform: rotate(-9deg);
  }

  50% {
    transform: rotate(9deg);
  }
}

@keyframes tree-twinkle {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }

  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.snowflake {
  animation: tree-snow 9s linear infinite;
  animation-delay: var(--snow-delay, 0s);
}

@keyframes tree-snow {
  0% {
    opacity: 0;
    transform: translate(-14px, -30px);
  }

  15% {
    opacity: 0.95;
  }

  85% {
    opacity: 0.85;
  }

  100% {
    opacity: 0;
    transform: translate(16px, 260px);
  }
}

.glow {
  transform-origin: 0 0;
  animation: star-glow 3.6s ease-in-out infinite;
}

@keyframes star-glow {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.9);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

.reward-star {
  transform-origin: 0 0;
  animation: star-breathe 3.6s ease-in-out infinite;
}

@keyframes star-breathe {
  0%,
  100% {
    transform: rotate(-3deg) scale(1);
  }

  50% {
    transform: rotate(3deg) scale(1.06);
  }
}

/* 偏好减少动态：全部静止，但保留构图 */
@media (prefers-reduced-motion: reduce) {
  .glow,
  .pig-tail,
  .reward-star,
  .snowflake,
  .tree-canvas,
  .tree-light,
  .tree-sun-rays {
    transform: none;
    animation: none;
  }

  .tree-canvas {
    transform: translate(-50%, -50%);
  }

  .snowflake {
    opacity: 0.8;
  }
}
</style>
