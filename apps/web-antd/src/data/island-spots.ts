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
