import type { LearnModule, TileKey } from './modules';

import { isLearnModule } from './modules';

/** 岛场景的坐标系。所有坐标都在这个空间里，由 KidIsland 等比缩放。 */
export const ISLAND_VIEWBOX = { height: 660, width: 1000 } as const;

export interface IslandSpot {
  key: TileKey;
  /** 后排 'back' 更小更靠上（远·小岛），前排 'front' 更大更靠下（近·大岛） */
  row: 'back' | 'front';
  scale: number;
  /** 微岛「落地点」横坐标（岛中心的 x） */
  x: number;
  /** 微岛「落地点」纵坐标（沙洲底座中心所在高度） */
  y: number;
}

/**
 * 7 座微型小岛，散落在海面上，按产品主次排序（从左到右、由上到下）：
 * 看图识物 → 英文乐园 → 中文乐园 → 数字王国 → 古诗花园 → 逻辑挑战 → 闯关冒险。
 *
 * 没有中央大岛了：每个地点独占一座微岛，靠「远近景深」营造海上群岛的层次
 * —— 越远越小、越靠上（远），越近越大、越靠下（近）。
 *
 * 布局分三层：
 * - 前排（近·大，scale 0.92）：cards / letters / pinyin / numbers —— 主推内容；
 * - 后排（远·小，scale 0.66）：poems / logic；
 * - 山脚（最远，scale 0.55）：adventure —— 贴在远山脚下，营造「远方冒险」。
 *
 * 注意：「儿歌点播 songs」与「我的星星 rewards」已从首页移除：
 * - songs 的入口改由其它方式承载；
 * - rewards 的入口绑定到右上角 HUD 的星星上（见 kid-hud.vue）。
 *
 * 约束（微岛版）：
 * - 每座微岛含「名字牌 + 图标 + 沙洲底座」，整体高约 120px（锚点上方 ~120、
 *   下方 ~16），再乘 scale。
 * - 后排 scale 0.66：名字牌顶边 ≈ y - 79，必须落在海面顶部（y=406）之下 → y ≥ 485。
 * - 前排 scale 0.92：沙洲底边 ≈ y + 15，必须落在视口底部（y=660）之内 → y ≤ 645。
 * - 山脚 scale 0.55 是特例：名字牌顶 ≈ y - 66 会伸进远山山腰，正是「山脚远景」的
 *   效果，不适用上面的海面岛约束。
 * - 相邻岛中心 x 至少隔 ~150，避免图标与名字牌互相遮挡。
 * - 小猪的游泳路线（kid-island.vue 的 SWIM_PATH）环绕本岛群外围，改坐标时
 *   需同步检查其顶部带（≈412）与底部带（≈642）不压到岛。
 */
export const ISLAND_SPOTS: IslandSpot[] = [
  // 前排（近·大）：看图识物、英文乐园、中文乐园、数字王国
  { key: 'cards', row: 'front', scale: 0.92, x: 200, y: 590 },
  { key: 'letters', row: 'front', scale: 0.92, x: 400, y: 610 },
  { key: 'pinyin', row: 'front', scale: 0.92, x: 600, y: 590 },
  { key: 'numbers', row: 'front', scale: 0.92, x: 800, y: 610 },
  // 后排（远·小）：古诗花园、逻辑挑战
  { key: 'poems', row: 'back', scale: 0.66, x: 300, y: 498 },
  { key: 'logic', row: 'back', scale: 0.66, x: 700, y: 496 },
  // 山脚（最远）：闯关冒险，贴在远山脚下
  { key: 'adventure', row: 'back', scale: 0.55, x: 500, y: 442 },
];

/**
 * 按模块开关过滤。
 *
 * 回调只接受 `LearnModule`（8 个可学习模块）。当前岛上全是学习模块
 * （rewards/songs 已从首页移除），但保留 `isLearnModule` 类型守卫而非假设
 * 全是学习模块：未来若再加非学习入口，无需改这里的逻辑。
 *
 * 用 `isLearnModule` 而非 `spot.key === 'xxx'` 判断，是因为后者无法让 TS
 * 收窄 `spot.key`，调用方传 `kidStore.moduleEnabled`（参数是 `LearnModule`）
 * 时会编译不过。
 */
export function spotsFor(enabled: (key: LearnModule) => boolean): IslandSpot[] {
  return ISLAND_SPOTS.filter((spot) =>
    isLearnModule(spot.key) ? enabled(spot.key) : true,
  );
}

/**
 * 圣诞树场景的坐标系。
 *
 * 为什么另起一个画布而不是复用岛场景：岛场景是 1000×660 的**横向**风景画
 * （岛群仅占 x 200~800），竖屏下要缩到 0.39 倍才装得下，微岛与名字牌小到看不清
 * —— 这正是竖屏换树的起因。圣诞树是**纵向**构图，视口比例 ≈ 0.56~0.5，所以画布
 * 取 520×940（比例 0.553）。
 *
 * ## 场景区（SCENE_BOX）与自适应
 *
 * 画布的 0~940 并不是全部有效内容：顶部 0~60 是留给 HUD 的空隙，底部 900~940
 * 是草地余量。真正「必须完整可见」的是 `SCENE_BOX` 那一段。布局按 `SCENE_BOX`
 * 做 contain 缩放（见 kid-tree.vue），所以不同比例的屏幕都能看到整棵树，
 * 不靠 slice 裁切。
 */
export const TREE_VIEWBOX = { height: 940, width: 520 } as const;

/**
 * 缩放与居中的基准框（画布坐标）。木牌、树冠、树干、树顶星星都必须落在这个框内，
 * 否则极端比例的屏幕上会被挤出可视区 —— 这就是「树高度溢出」的成因。
 *
 * ## 为什么必须**覆盖全树**而不是只框住木牌
 *
 * 早期版本只按木牌定位框（`top:112 / bottom:800`），漏掉了两处比木牌更高/更低的
 * 内容：**树顶星星（上沿 y=72）** 与 **树干底（y=892）**。于是 contain 缩放按
 * 木牌框算出的比例偏大 → 整棵树（含星星与树干）在纵向溢出视口，树顶被 HUD 压住、
 * 树干被切掉。
 *
 * 现在按「全树外接框」取值：
 * - 横向：树冠最宽处（第 4 层半宽 198）→ x 62~458；木牌最大外沿 x 130~390 在其内。
 * - 纵向：树顶星星上沿 72 → 树干底 892。
 *
 * 两端各留一点余量（横向 ±12、纵向上 6 下 6），给 `plank-sway` 的 ±2.4° 摆动
 * 与树冠下摆的波浪留空间。
 *
 * ## 框的宽高比要贴近手机竖屏（否则「树高度利用率低」）
 *
 * 本框的 `width/height` 决定 contain 后哪一维先顶满。手机竖屏比例约 0.46~0.47
 * （390×844），所以框也应该是同量级的**窄高**比例：
 *
 * - 早期取值 476×832（比例 0.572）比手机更宽 → 宽度先满，纵向只用 682/844
 *   （81%），上下各留 80px 空白，观感上就是「树没长满、悬在中间」。
 * - 现在的 420×832（比例 0.505）把树冠横向下收到半宽 198，框变窄 →
 *   常见竖屏（0.45~0.51）都是高度先满或接近先满，纵向利用率 ≈ 91%
 *   （更宽的平板/大屏则高度 100% 顶满）。
 *
 * ⚠️ 想让竖屏「树更长」要改的是**树的形状**（收窄 `TIERS` 的 `half`），
 * 而不是只把本框裁窄 —— 光裁框会让树被切掉。
 *
 * 注意本框（420×832）仍比画布（520×940）小，所以 contain 缩放后舞台会留白，
 * 由 CSS 渐变补（见 kid-tree.vue 的 `.tree-stage`）。
 */
export const TREE_SCENE_BOX = {
  bottom: 898,
  height: 832,
  left: 50,
  right: 470,
  top: 66,
  width: 420,
} as const;

export interface TreeBranch {
  key: TileKey;
  /**
   * 木牌悬挂点（绳子上端）。取在**该层树冠的下摆**上，木牌从这里垂下来，
   * 视觉上是「挂在圣诞树的这一层上」。
   */
  anchor: { x: number; y: number };
  /**
   * 按层缩放系数。上层窄所以牌子小、下层宽所以牌子大 —— 既保证上层两块放得下
   * （层 1 下摆只有 224 宽），也天然形成「越往下入口越大」的层级感。
   * 与 kid-tree.vue 的 TIERS 一一对应：层 1=0.60、层 2=0.70、层 3=0.82、层 4=0.92。
   */
  tierScale: number;
  /** 木牌中心，在挂点正下方 */
  x: number;
  y: number;
}

/**
 * 7 块木牌按圣诞树的 4 层（见 kid-tree.vue 的 TIERS）分配。
 *
 * ## 顺序：**从下往上** = 首页磁贴的阅读顺序
 *
 * 用户明确要求木牌自下而上依次是：看图识物 → 英文乐园 → 中文乐园 → 数字王国
 * → 古诗花园 → 逻辑挑战 → 闯关冒险。即**最下层挂第一个模块、最上层挂最后一个**
 * —— 视线从树底一路往上读到树顶，与「爬树闯关」的叙事一致（越往上越难）。
 *
 * 对应到 4 层（层 4 最下最宽、层 1 最上最窄）：
 *
 * | 层 | 挂什么 | 块数 |
 * | -- | ------ | ---- |
 * | 4（最下）| cards 看图识物、letters 英文乐园 | 2 |
 * | 3 | pinyin 中文乐园、numbers 数字王国 | 2 |
 * | 2 | poems 古诗花园、logic 逻辑挑战 | 2 |
 * | 1（最上）| adventure 闯关冒险 | 1（最窄，只放一块）|
 *
 * ⚠️ **不要按「从上往下」的直觉重排**：本表是按**层号从下往上**写的，
 * 数组顺序就是视觉上从下到上的顺序，不是磁贴顺序。
 *
 * ⚠️ 这是「树层下摆」与「挂点」之间的契约，两条约束缺一不可：
 *
 * 1. `anchor.y` 必须等于该层下摆的 y（见 kid-tree.vue 的 TIERS 表），且
 *    `y = anchor.y - 30 × tierScale` —— 木牌组件的绳子长为 `30 × tierScale`、
 *    牌体从绳子末端起画（见 kid-plank.vue 的 `PLANK.rope`），这样牌体顶边才
 *    正好吻住树层下摆。
 * 2. `anchor.x` 必须落在该层底半宽以内（层 4 半宽 198、层 3 是 166、层 2 是 134、
 *    层 1 是 100，都以 x=260 为中心），否则绳子挂在树层轮廓之外，一眼假。
 *
 * `kid-tree-hotspots.vue` 直接复用本表的 `x/y/tierScale` —— 那个不可见热区是
 * 3-5 岁幼儿能点中木牌的唯一保证，不要改成每次渲染实时解析几何取精确点
 * （性能没必要，且多一层 DOM 依赖会随 `<g>` 定位一起漂移）。
 *
 * ## 为什么只有 7 块（不含 songs / rewards）
 *
 * 与海岛同一套入口范围：`songs`（儿歌点播）已从首页下线（原注释：「入口改由
 * 其它方式承载」，那个方式至今未做，`KidSongs` 路由当前无可达入口）；
 * `rewards` 不在这里 —— 它是树顶那颗星星，是「果实」而不是「木牌」。
 * 所以**不要**为了凑 8 或 9 块把 songs 加回来，那等于绕过既有决策。
 */
export const TREE_BRANCHES: TreeBranch[] = [
  // ── 第 4 层（最下，下摆 y=718，半宽 198，牌子最大）──
  // 自下而上的第 1、2 个
  { anchor: { x: 182, y: 718 }, key: 'cards', tierScale: 0.92, x: 182, y: 690 },
  {
    anchor: { x: 338, y: 718 },
    key: 'letters',
    tierScale: 0.92,
    x: 338,
    y: 690,
  },
  // ── 第 3 层（下摆 y=596，半宽 166）──
  // 自下而上的第 3、4 个
  {
    anchor: { x: 154, y: 596 },
    key: 'pinyin',
    tierScale: 0.82,
    x: 154,
    y: 571,
  },
  {
    anchor: { x: 366, y: 596 },
    key: 'numbers',
    tierScale: 0.82,
    x: 366,
    y: 571,
  },
  // ── 第 2 层（下摆 y=452，半宽 134）──
  // 自下而上的第 5、6 个
  { anchor: { x: 190, y: 452 }, key: 'poems', tierScale: 0.7, x: 190, y: 431 },
  { anchor: { x: 330, y: 452 }, key: 'logic', tierScale: 0.7, x: 330, y: 431 },
  // ── 第 1 层（最上，下摆 y=306，半宽 100，牌子最小）──
  // 自下而上的第 7 个：最窄的一层只放一块，居中
  {
    anchor: { x: 260, y: 306 },
    key: 'adventure',
    tierScale: 0.6,
    x: 260,
    y: 288,
  },
];

/** 按模块开关过滤木牌（与 spotsFor 同语义） */
export function treeBranchesFor(
  enabled: (key: LearnModule) => boolean,
): TreeBranch[] {
  return TREE_BRANCHES.filter((branch) =>
    isLearnModule(branch.key) ? enabled(branch.key) : true,
  );
}

/**
 * 树顶星星（我的星星）的位置：挂点 + 星体中心。
 *
 * 挂在树顶尖角（y=120）正上方，是天经地义的圣诞树顶星。星体外半径 46，
 * 所以上沿 y=118-46=72 —— 仍在 HUD（约 76~100px）之下，不会被压住。
 */
export const TREE_REWARD = {
  anchor: { x: 260, y: 120 },
  x: 260,
  y: 118,
} as const;
