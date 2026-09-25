# 学习模块框架与家长端内容配置 — 设计规格

> 版本：v1.0 ｜ 日期：2026-09-26 ｜ 基线：`docs/child-study-design.md`（v1.0）落地后的代码现状
>
> 本规格覆盖**子项目 #1（框架基建）**，并给出 #2–#6 的路线图。#2–#6 各自另有独立 spec。

## 1. 背景

`docs/child-study-design.md` 定义的 P0–P5 已完成，当前 `apps/web-antd` 中宝宝端已有 5 个入口、家长端已有 5 个页面。

现在要新增 4 个学习模块并把「数字小屋」扩容为「数字王国」，同时让家长端的「内容管理」覆盖这些新模块。**现有代码结构支撑不了这件事**，三处硬编码会成为每加一个模块都要重复的改点：

| 位置 | 现状 | 问题 |
|---|---|---|
| `store/kid.ts` | `LearnModule = 'cards' \| 'letters' \| 'numbers' \| 'songs'` 与 `MODULE_KEYS` 手写 | 加模块要改类型 + 改数组 |
| `store/kid.ts` | `dailyGoals: Record<LearnModule, number>` 固定 4 键 | 新模块缺 key 会算出 `undefined` |
| `data/use-content.ts` | 只有 `cards` 走 overrides 合并；`letters`/`numbers`/`songs` 直接返回内置数组 | 家长无法管理新模块内容 |
| `views/parent/plan/index.vue` | `MODULE_EMOJI` 硬编码 4 个模块 | 新模块不显示 |
| `views/parent/content/index.vue` | 只服务 cards 的 Table + Modal | 每加一个内容型模块就要复制一份页面 |

## 2. 需求确认

| 模块 | 状态 | 宝宝端形态 | 家长端配置类型 |
|---|---|---|---|
| 字母乐园 | 现有，**不改动** | 英文 A-Z 认读 + 考一考 | 参数型 |
| **拼音乐园** | 新增 | 投屏大字、点按切换、错题本闭环 | 内容型 |
| **数字王国** | 由「数字小屋」改名扩容 | 数字认知 + 加减练习 + 数字游戏 | 参数型 |
| **古诗花园** | 新增 | 仅点播朗读（大字 + 逐句朗读 + 配图），**不做答题** | 内容型 |
| **逻辑挑战** | 新增 | 找规律 / 分类归类 / 比较与排序 / 配对与空间 | 内容型 |
| **闯关冒险** | 新增 | 独立小游戏，自成一体，递进关卡 | 内容型 |

配置粒度按模块类型分级：

- **内容型**：家长可完整增 / 改 / 删
- **参数型**：家长可开关 + 设难度区间
- **固定型**：不可配置

## 3. 路线图

| # | 子项目 | 依赖 | 验收口径 |
|---|---|---|---|
| **1** | **模块框架 + 家长端内容配置基建**（本 spec） | — | 现有功能零回退；家长端能管 cards；新增模块只需注册一条配置 |
| 2 | 拼音乐园（含错题本） | #1 | 拼音可学可考，错题本闭环可用 |
| 3 | 数字王国（认知 + 加减 + 游戏） | #1 | 三子模式可玩，难度区间受家长端控制 |
| 4 | 古诗花园（点播朗读） | #1 | 诗单可点播，家长可维护诗单 |
| 5 | 逻辑挑战（四题型） | #1、#2 | 四题型可玩，家长可维护题库 |
| 6 | 闯关冒险（独立小游戏） | #1、#2、#5 | 关卡可玩可编排 |

选择「框架先行」的理由见 §1 —— 若不先打通这条链路，#2–#6 每个模块都要重复三次改代码并复制一份家长端页面。

## 4. 模块注册表

新建 `apps/web-antd/src/data/modules.ts`，作为模块元信息的**单一事实源**。

```ts
export const MODULE_KEYS = [
  'cards', 'letters', 'numbers', 'songs', 'rewards',
] as const;

export type LearnModule = (typeof MODULE_KEYS)[number];

export type ModuleKind = 'content' | 'param' | 'fixed';

export interface ModuleDef {
  key: LearnModule;
  /** 首页磁贴与家长端的图标 */
  emoji: string;
  /** 宝宝端路由路径 */
  path: string;
  /** 首页磁贴底色 class */
  bg: string;
  kind: ModuleKind;
  /** 每日目标的默认值 */
  defaultGoal: number;
  /** 参数型模块：难度区间的上下界与默认值 */
  range?: { min: number; max: number; default: number };
  /** 内容型模块：家长端表单的字段声明 */
  fields?: FieldDef[];
}

export interface FieldDef {
  key: string;
  /** i18n key，挂在 parent.content 下 */
  labelKey: string;
  type: 'text' | 'emoji' | 'number' | 'textarea' | 'stringList' | 'select';
  required?: boolean;
  maxLength?: number;
  /** type === 'select' 时的选项来源（如 cards 的分类） */
  options?: () => { label: string; value: string }[];
}

export const MODULES: Record<LearnModule, ModuleDef> = { /* ... */ };
```

**本 spec 只为 `MODULE_KEYS` 中已存在的 5 个 key 建立注册表**，并迁移 `cards` 到新框架。新模块由各自的子项目在实现时追加 key 与配置 —— 不留空壳 key，避免出现指向不存在页面的磁贴。

> `LearnModule` 由常量数组派生后，新增模块只改 `MODULE_KEYS` 一行，类型、注册表、循环渲染自动跟随。

### 4.1 类型放置与循环依赖

`LearnModule` 目前定义在 `store/kid.ts`。注册表位于 `data/modules.ts`，而 store 需要引用注册表读取默认目标。为避免 `store → data → store` 的循环引用：

- 类型与常量定义在 `data/modules.ts`
- `store/kid.ts` 从 `data/modules.ts` 导入；`data/` 下不反向导入 store
- 现有 `from '#/store'` 导出 `LearnModule` / `MODULE_KEYS` 的用法保留为**再导出**，避免大面积改 import 路径

## 5. 内容层泛化

`data/use-content.ts` 的 `useContent()` 泛化为通用集合：

```ts
export interface ContentItemBase {
  id: string;
}

export interface CollectionConfig<T extends ContentItemBase> {
  key: LearnModule;
  /** 内置默认项 */
  defaults: T[];
  /** 校验草稿；返回错误文案的 i18n key，通过则返回 undefined */
  validate?: (draft: Partial<T>) => string | undefined;
}

export function useCollection<T extends ContentItemBase>(
  config: CollectionConfig<T>,
): {
  items: ComputedRef<T[]>;
  add: (draft: Omit<T, 'id'>) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
};
```

合并语义**与现有 `cards` 完全一致**，逐条保留：

1. 遍历 `defaults`，跳过 `patch.deleted` 的项，有 patch 则浅合并
2. 追加 `patch.added` 的新增项（id 形如 `custom-<timestamp>`）
3. 新增项 id 冲突时以 overrides 中的为准

现有 `useContent()` 改造为薄封装，内部用 `useCollection` 构造 cards 集合，**保持 `cards` / `cardsByCategory` / `addCard` / `updateCard` / `deleteCard` 的对外签名逐一不变**，调用方（宝宝端 `cards` 页、家长端 `content` 页、`card-form-modal`）不需要改动。这是本子项目「零回退」验收口径的落点之一。

## 6. 数据迁移（关键风险）

`contentOverrides` 当前是**扁平单层**结构，只服务 cards：

```ts
contentOverrides: ref<Record<string, any>>({})   // { a1: { name: '...' }, 'custom-123': {...} }
```

多模块需要按模块分组：

```ts
contentOverrides: Record<LearnModule, Record<string, Patch>>
// { cards: { a1: {...} }, ... }
```

`contentOverrides` 在 store 的 persist `pick` 列表中，**直接改结构会让已存在用户的自定义卡片全部失效**。

**迁移规则**（在 store 初始化时执行一次）：

- 若 `contentOverrides` 顶层不含任何 `MODULE_KEYS` 中的 key，判定为旧结构，整体搬入 `contentOverrides.cards`
- 若为空对象，不做处理
- 若已含模块 key，判定为新结构，跳过
- 迁移过程中抛错时，**保留原结构不变**并 `console.warn`，不破坏用户数据

## 7. 每日目标与参数型配置

`dailyGoals` 由 `Record<LearnModule, number>` 改为 `Partial<Record<LearnModule, number>>`，读取时回落到注册表的 `defaultGoal`：

```ts
function goalOf(module: LearnModule): number {
  return dailyGoals.value[module] ?? MODULES[module].defaultGoal;
}
```

这样新增模块不会因为缺 key 而算出 `undefined`（当前 `todayCountsOf` 与 `rewards` 页依赖每日目标）。

参数型模块的难度区间同样存 `Partial<Record<LearnModule, number>>`，读取回落 `MODULES[module].range.default`。

## 8. 家长端改造

### 8.1 内容管理（`views/parent/content/index.vue`）

改为顶部分模块 Tab，每个**内容型**模块一个 Tab，共用一个字段驱动的 CRUD 表格。

- 列与表单字段由 `MODULES[key].fields` 驱动渲染，不再为每个模块写一个页面
- 表单校验由 `FieldDef.required` / `maxLength` 与集合的 `validate` 共同承担
- 过滤、分页、删除确认沿用现有实现

### 8.2 学习计划（`views/parent/plan/index.vue`）

- 每日目标列表由 `MODULE_KEYS` 动态生成，移除硬编码的 `MODULE_EMOJI`
- 新增「模块开关 + 难度区间」区块，仅渲染 `kind === 'param'` 的模块
- 护眼时长区块保持不变

### 8.3 首页磁贴（`views/kid/home/index.vue`）

磁贴数组改为由注册表派生（`emoji` / `bg` / `path` / `labelKey`），移除硬编码的 5 项数组。本 spec 不新增磁贴，磁贴数量不变。

## 9. 错题本（契约定义）

错题本按 pinyin-vue 的做法补齐闭环 —— 现有 `useQuiz` 答错只调 `wrong()` 做语音鼓励，**不记录任何数据**。

职责切分：**本 spec（子项目 #1）实现 store 层的 `wrongBook` 数据结构与读写接口**（可与其余框架改动一同单测），**子项目 #2 实现 UI 与 `useQuiz` 的写入接线**。这样框架层一次做对，玩法层不必再动 store。

```ts
export interface WrongItem {
  module: LearnModule;
  itemId: string;
  count: number;
  lastAt: number;
}

// store 新增
wrongBook: Ref<Record<string /* childId */, WrongItem[]>>;
addWrong(childId: string, module: LearnModule, itemId: string): void;
removeWrong(childId: string, module: LearnModule, itemId: string): void;
wrongOf(childId: string, module: LearnModule): WrongItem[];
clearWrong(childId: string, module?: LearnModule): void;
```

- 写入 `persist.pick`，按孩子归属（与 `records` 一致）
- 宝宝端交互采用 **ModeTabs 第三个页签「错题本」**，仅当该模块存在错题时显示，复用现有 `ModeTabs` 组件
- 不采用 pinyin-vue 的长按菜单：长按在触屏投屏场景下不易被发现，且与本项目已有的模式页签交互语言不一致
- 家长端在「学习报告」页提供查看与清空

## 10. 错误处理

| 场景 | 处理 |
|---|---|
| 家长端表单校验失败 | 不写入，表单内联提示，文案走 i18n |
| 覆盖项引用了已删除的内置 id | 读取时过滤孤儿项，静默丢弃 |
| 迁移失败或数据形状异常 | 保留原结构，`console.warn`，不抛出 |
| 新增模块未在注册表声明字段 | 家长端该 Tab 显示空态而非报错 |

## 11. 测试

`vitest` 已配置（`pnpm test:unit`，`#` 别名指向 `apps/web-antd/src`），现有测试见 `store/__tests__/relationship.test.ts`。

新增单测：

1. `useCollection` 合并语义 —— 内置改、内置删、新增、id 冲突
2. **旧结构迁移** —— 扁平 overrides 正确搬入 `cards`；已是新结构时不重复迁移；空对象不处理
3. `dailyGoals` 缺 key 时回落 `defaultGoal`
4. 孤儿覆盖项被过滤
5. 错题本 `add` / `remove` / 按模块查询 / 按孩子隔离

## 12. 验收标准

- [ ] `pnpm test:unit` 全绿
- [ ] `pnpm check:type` 通过
- [ ] `pnpm -F @vben/web-antd run check:i18n` 通过（zh-CN 与 en-US 语言包保持同步）
- [ ] 宝宝端 5 个模块功能与样式**零回退**，首页磁贴数量与跳转不变
- [ ] 家长端内容管理对 cards 的增 / 改 / 删行为与改造前一致
- [ ] 模拟「带旧 `contentOverrides` 的 localStorage」进入应用，自定义卡片**不丢失**
- [ ] 家长端学习计划页正常渲染每日目标与护眼设置
- [ ] 在注册表加一个临时模块 key，家长端与首页自动跟随；移除后无残留

## 13. 不在本 spec 范围

- 拼音乐园、数字王国、古诗花园、逻辑挑战、闯关冒险的**具体玩法与内容数据**
- 错题本的 **UI 与 `useQuiz` 写入接线**（store 层契约与接口已在 #1 内实现，见 §9）
- 闯关冒险的玩法设计 —— 它自成一体，由子项目 #6 自己的 spec 定义
- `songs` 由固定型降级为内容型（儿歌可编辑）—— 当前无此需求
