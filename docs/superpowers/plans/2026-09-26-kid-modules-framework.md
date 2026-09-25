# 学习模块框架 + 家长端内容配置基建 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把模块元信息收敛为可扩展的注册表，并让家长端内容管理从「只服务卡片」扩展为按模块类型分级的通用能力。

**Architecture:** 新建 `data/modules.ts` 作为模块元信息单一事实源；`contentOverrides` 由扁平结构改为按模块分组（带 localStorage 迁移）；内容层抽出 `useCollection` 通用集合，`useContent` 保持对外签名不变；家长端内容管理改为模块 Tab + 字段驱动表单。

**Tech Stack:** Vue 3.5 `<script setup>`、TypeScript、Pinia + pinia-plugin-persistedstate 4.7.1、ant-design-vue 4、Vitest（happy-dom）。

**Spec:** `docs/superpowers/specs/2026-09-26-kid-modules-framework-design.md`

## Global Constraints

- 包管理器只用 `pnpm`，禁止 `npm` / `yarn`。
- 语言包 `zh-CN` 与 `en-US` **必须同步增删键**，`pnpm -F @vben/web-antd run check:i18n` 必须通过。
- 内容层（卡片名称/拼音、字母释义、数字汉字、儿歌歌词）是**中文单语，不参与 i18n**；朗读这类内容固定传 `CONTENT_TTS_LANG`。本计划不新增内容层文案。
- 宝宝端面向 3-6 岁：点击目标 ≥ 80×80px、零文字门槛、**儿童界面不出现错误弹窗**。
- 注释用中文，与现有代码风格一致（现有文件均为中文 JSDoc）。
- 每个 Task 结束时必须：`pnpm -F @vben/web-antd run typecheck` 通过 + 该 Task 的测试通过。
- 提交信息用中文，遵循 `<type>: <描述>` 格式（`feat` / `refactor` / `test` / `fix`）。
- **验收基线：本计划完成后，宝宝端 5 个模块与家长端内容管理对 cards 的行为零回退。**

## 与 spec 的一处偏差（已确认必要）

spec §4 写的是 `MODULES: Record<LearnModule, ModuleDef>`。实现时引入 `TileKey` 作为超集：

```ts
export const MODULE_KEYS = ['cards','letters','numbers','songs'] as const;  // 可学习模块
export const TILE_KEYS = [...MODULE_KEYS, 'rewards'] as const;              // 首页磁贴（含非学习入口）
```

原因：现有 `MODULE_KEYS` 只有 4 项（不含 `rewards`），而首页磁贴有 5 项。若把 `rewards` 塞进 `MODULE_KEYS`，家长端学习计划页和宝宝端奖励页会多出一个目标为 0 的假任务。用 `TileKey` 超集隔离两种语义，`rewards` 的 `kind` 为 `fixed`、不参与每日目标。

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `apps/web-antd/src/data/modules.ts` | 模块元信息注册表（类型 + 常量 + 字段声明） | 新建 |
| `apps/web-antd/src/data/migrate-content-overrides.ts` | `contentOverrides` 结构迁移（纯函数） | 新建 |
| `apps/web-antd/src/data/use-collection.ts` | 通用内容集合（内置 + 覆盖项合并、增改删） | 新建 |
| `apps/web-antd/src/data/use-content.ts` | 内容层对外出口（签名保持不变） | 改造 |
| `apps/web-antd/src/store/kid.ts` | 状态：覆盖项结构、每日目标、模块设置、错题本 | 改造 |
| `apps/web-antd/src/views/kid/home/index.vue` | 首页磁贴由注册表派生 + 按模块开关过滤 | 改造 |
| `apps/web-antd/src/views/kid/rewards/index.vue` | 每日任务 emoji / 目标改为注册表驱动 | 改造 |
| `apps/web-antd/src/views/parent/content/index.vue` | 内容管理：模块 Tab + 字段驱动 CRUD | 改造 |
| `apps/web-antd/src/views/parent/components/content-form-modal.vue` | 字段驱动表单 | 新建 |
| `apps/web-antd/src/views/parent/components/card-form-modal.vue` | 被上一个替代 | 删除 |
| `apps/web-antd/src/views/parent/plan/index.vue` | 学习计划：动态模块 + 参数型开关/区间 | 改造 |

---

## Task 1: 模块注册表 + 首页磁贴注册表化

**Files:**
- Create: `apps/web-antd/src/data/modules.ts`
- Create: `apps/web-antd/src/data/__tests__/modules.test.ts`
- Modify: `apps/web-antd/src/views/kid/home/index.vue`

**Interfaces:**
- Consumes: `apps/web-antd/src/data/content.ts` 的 `kidCategories`（已有）
- Produces:
  - `MODULE_KEYS: readonly ['cards','letters','numbers','songs']`
  - `TILE_KEYS: readonly [...MODULE_KEYS, 'rewards']`
  - `type LearnModule = (typeof MODULE_KEYS)[number]`
  - `type TileKey = (typeof TILE_KEYS)[number]`
  - `type ModuleKind = 'content' | 'fixed' | 'param'`
  - `interface FieldDef { key, labelKey, type, required?, maxLength?, options? }`
  - `interface ModuleDef { key, emoji, path, bg, kind, defaultGoal, range?, fields? }`
  - `MODULES: Record<TileKey, ModuleDef>`

- [ ] **Step 1: 写失败测试**

创建 `apps/web-antd/src/data/__tests__/modules.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { MODULE_KEYS, MODULES, TILE_KEYS } from '#/data/modules';

/**
 * 注册表不变量：新增模块时这些断言保证注册信息完整，
 * 避免首页磁贴 / 家长端表单出现空白项。
 */
describe('模块注册表', () => {
  it('每个磁贴 key 都有对应配置且 key 自洽', () => {
    for (const key of TILE_KEYS) {
      expect(MODULES[key]).toBeDefined();
      expect(MODULES[key].key).toBe(key);
    }
  });

  it('每个磁贴都有首页展示所需的 emoji / bg / path', () => {
    for (const key of TILE_KEYS) {
      const def = MODULES[key];
      expect(def.emoji).toBeTruthy();
      expect(def.bg).toMatch(/^bg-/);
      expect(def.path).toMatch(/^\/kid\//);
    }
  });

  it('可学习模块都有正整数每日目标', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULES[key].defaultGoal).toBeGreaterThan(0);
    }
  });

  it('内容型模块都声明了表单字段', () => {
    for (const key of TILE_KEYS) {
      if (MODULES[key].kind !== 'content') continue;
      expect(MODULES[key].fields?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('参数型模块都声明了难度区间且默认值落在区间内', () => {
    for (const key of TILE_KEYS) {
      const def = MODULES[key];
      if (def.kind !== 'param') continue;
      expect(def.range).toBeDefined();
      const { default: fallback, max, min } = def.range!;
      expect(fallback).toBeGreaterThanOrEqual(min);
      expect(fallback).toBeLessThanOrEqual(max);
    }
  });

  it('非学习入口不参与每日目标', () => {
    for (const key of TILE_KEYS) {
      if ((MODULE_KEYS as readonly string[]).includes(key)) continue;
      expect(MODULES[key].defaultGoal).toBe(0);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/modules.test.ts
```
Expected: FAIL — `Failed to resolve import "#/data/modules"`

- [ ] **Step 3: 实现注册表**

创建 `apps/web-antd/src/data/modules.ts`：

```ts
/**
 * 模块注册表：宝宝端与家长端共用的模块元信息**单一事实源**。
 *
 * 新增学习模块时，只需在 MODULE_KEYS 追加 key 并在 MODULES 补一条配置，
 * 首页磁贴、每日目标、家长端内容管理 Tab 与学习计划会自动跟随。
 *
 * ⚠️ 本文件不依赖 store，避免 store → data → store 的循环引用。
 */

import { kidCategories } from './content';

/** 可学习模块：参与每日目标、学习记录与星星统计 */
export const MODULE_KEYS = ['cards', 'letters', 'numbers', 'songs'] as const;

export type LearnModule = (typeof MODULE_KEYS)[number];

/** 首页磁贴：比可学习模块多出非学习入口（如「我的星星」） */
export const TILE_KEYS = [...MODULE_KEYS, 'rewards'] as const;

export type TileKey = (typeof TILE_KEYS)[number];

/**
 * content — 家长可完整增/改/删（配 fields）
 * param   — 家长可开关 + 设难度区间（配 range）
 * fixed   — 不可配置
 */
export type ModuleKind = 'content' | 'fixed' | 'param';

/** 内容型模块在家长端表单里的字段声明 */
export interface FieldDef {
  key: string;
  /** i18n key，取值挂在 parent.content 下 */
  labelKey: string;
  type: 'emoji' | 'number' | 'select' | 'stringList' | 'text' | 'textarea';
  required?: boolean;
  maxLength?: number;
  /** type === 'select' 时的选项来源 */
  options?: () => { label: string; value: string }[];
}

export interface ModuleDef {
  key: TileKey;
  emoji: string;
  /** 宝宝端路由路径 */
  path: string;
  /** 首页磁贴底色 class */
  bg: string;
  kind: ModuleKind;
  /** 每日目标默认值；非学习入口为 0 */
  defaultGoal: number;
  range?: { default: number; max: number; min: number };
  fields?: FieldDef[];
}

export const MODULES: Record<TileKey, ModuleDef> = {
  cards: {
    bg: 'bg-orange-400',
    defaultGoal: 10,
    emoji: '🐘',
    fields: [
      { key: 'name', labelKey: 'name', required: true, type: 'text' },
      { key: 'pinyin', labelKey: 'pinyin', type: 'text' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
      {
        key: 'categoryId',
        labelKey: 'category',
        options: () =>
          kidCategories.map((c) => ({ label: c.name, value: c.id })),
        type: 'select',
      },
      { key: 'fact', labelKey: 'fact', type: 'textarea' },
    ],
    key: 'cards',
    kind: 'content',
    path: '/kid/cards',
  },
  letters: {
    bg: 'bg-sky-400',
    defaultGoal: 6,
    emoji: '🔤',
    key: 'letters',
    kind: 'param',
    path: '/kid/letters',
    range: { default: 26, max: 26, min: 6 },
  },
  numbers: {
    bg: 'bg-emerald-400',
    defaultGoal: 6,
    emoji: '🔢',
    key: 'numbers',
    kind: 'param',
    path: '/kid/numbers',
    range: { default: 10, max: 10, min: 5 },
  },
  songs: {
    bg: 'bg-violet-400',
    defaultGoal: 2,
    emoji: '🎵',
    key: 'songs',
    kind: 'fixed',
    path: '/kid/songs',
  },
  rewards: {
    bg: 'bg-amber-400',
    defaultGoal: 0,
    emoji: '⭐',
    key: 'rewards',
    kind: 'fixed',
    path: '/kid/rewards',
  },
};
```

> `defaultGoal` 的取值必须与改造前 `store/kid.ts` 的 `dailyGoals` 初始值一致（cards 10 / letters 6 / numbers 6 / songs 2），否则宝宝端每日任务进度会变化。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/modules.test.ts
```
Expected: PASS（6 个用例）

- [ ] **Step 5: 首页磁贴改为注册表派生**

修改 `apps/web-antd/src/views/kid/home/index.vue` 的 `<script setup>`：

把原来的

```ts
const tiles = [
  { bg: 'bg-orange-400', emoji: '🐘', key: 'cards', path: '/kid/cards' },
  { bg: 'bg-sky-400', emoji: '🔤', key: 'letters', path: '/kid/letters' },
  { bg: 'bg-emerald-400', emoji: '🔢', key: 'numbers', path: '/kid/numbers' },
  { bg: 'bg-violet-400', emoji: '🎵', key: 'songs', path: '/kid/songs' },
  { bg: 'bg-amber-400', emoji: '⭐', key: 'rewards', path: '/kid/rewards' },
];

function go(path: string, key: string) {
  speak($t(`kid.modules.${key}`));
  router.push(path);
}
```

替换为

```ts
/** 首页磁贴由模块注册表派生，新增模块无需改动本文件 */
const tiles = TILE_KEYS.map((key) => MODULES[key]);

function go(tile: ModuleDef) {
  speak($t(`kid.modules.${tile.key}`));
  router.push(tile.path);
}
```

并在文件顶部补 import（放在 `import { $t } from '#/locales';` 之前，保持路径字母序）：

```ts
import type { ModuleDef } from '#/data/modules';

import { MODULES, TILE_KEYS } from '#/data/modules';
```

模板中把 `@tap="go(tile.path, tile.key)"` 改为 `@tap="go(tile)"`，其余模板不变（`v-for="tile in tiles"`、`:bg`、`:desc`、`:emoji`、`:label` 均沿用 `tile.*`）。

- [ ] **Step 6: 类型检查 + 全量测试**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm test:unit
```
Expected: typecheck 无报错；测试全绿

- [ ] **Step 7: 手工验证首页零回退**

```bash
pnpm dev:antd
```
打开首页（`/kid/home`），确认 5 个磁贴的 emoji、底色、文案、跳转与改造前完全一致。

- [ ] **Step 8: 提交**

```bash
git add apps/web-antd/src/data/modules.ts apps/web-antd/src/data/__tests__/modules.test.ts apps/web-antd/src/views/kid/home/index.vue
git commit -m "refactor(kid): 模块元信息收敛为注册表，首页磁贴改为注册表派生"
```

---

## Task 2: contentOverrides 结构迁移

**Files:**
- Create: `apps/web-antd/src/data/migrate-content-overrides.ts`
- Create: `apps/web-antd/src/data/__tests__/migrate-content-overrides.test.ts`
- Modify: `apps/web-antd/src/store/kid.ts`
- Modify: `apps/web-antd/src/data/use-content.ts`（仅改读写路径，保持签名）

**Interfaces:**
- Consumes: Task 1 的 `TILE_KEYS`
- Produces:
  - `type ContentOverrides = Record<string, Record<string, unknown>>`
  - `migrateContentOverrides(input: unknown): ContentOverrides`
  - store 的 `contentOverrides: Record<string, Record<string, any>>`

- [ ] **Step 1: 写失败测试**

创建 `apps/web-antd/src/data/__tests__/migrate-content-overrides.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { migrateContentOverrides } from '#/data/migrate-content-overrides';

/**
 * 回归测试：contentOverrides 曾是「卡片 id → patch」的扁平结构，
 * 多模块改造后变为「模块 key → 卡片 id → patch」。
 * 迁移必须保证已存在用户的自定义卡片不丢失。
 */
describe('contentOverrides 结构迁移', () => {
  it('把旧的扁平结构整体搬入 cards', () => {
    const legacy = {
      a1: { name: '大象改' },
      'custom-abc': { added: true, name: '长颈鹿' },
    };
    expect(migrateContentOverrides(legacy)).toEqual({ cards: legacy });
  });

  it('已是新结构时原样返回', () => {
    const current = { cards: { a1: { name: '大象改' } } };
    expect(migrateContentOverrides(current)).toEqual(current);
  });

  it('新结构里的其他模块 key 不会被误判为旧结构', () => {
    const current = { cards: {}, songs: {} };
    expect(migrateContentOverrides(current)).toEqual(current);
  });

  it('空对象返回空对象', () => {
    expect(migrateContentOverrides({})).toEqual({});
  });

  it('非对象输入返回空对象，不抛错', () => {
    expect(migrateContentOverrides(null)).toEqual({});
    expect(migrateContentOverrides(undefined)).toEqual({});
    expect(migrateContentOverrides('x')).toEqual({});
    expect(migrateContentOverrides([])).toEqual({});
    expect(migrateContentOverrides(0)).toEqual({});
  });

  it('迁移是幂等的', () => {
    const once = migrateContentOverrides({ a1: { name: '大象' } });
    expect(migrateContentOverrides(once)).toEqual(once);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/migrate-content-overrides.test.ts
```
Expected: FAIL — `Failed to resolve import "#/data/migrate-content-overrides"`

- [ ] **Step 3: 实现迁移函数**

创建 `apps/web-antd/src/data/migrate-content-overrides.ts`：

```ts
import { TILE_KEYS } from './modules';

/** 覆盖项：模块 key → 条目 id → patch */
export type ContentOverrides = Record<string, Record<string, unknown>>;

const KNOWN_KEYS = new Set<string>(TILE_KEYS);

/**
 * 兼容旧持久化数据。
 *
 * `contentOverrides` 在支持多模块前是「卡片 id → patch」的扁平结构，
 * 现在改为「模块 key → 卡片 id → patch」。
 *
 * 判定规则：顶层出现任一已知模块 key 即视为新结构；否则视为旧结构，
 * 整体搬入 `cards`。无法识别的输入返回空对象，绝不抛错 —— 迁移失败
 * 不应该让应用起不来。
 */
export function migrateContentOverrides(input: unknown): ContentOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const raw = input as ContentOverrides;
  const keys = Object.keys(raw);
  if (keys.length === 0) return {};

  if (keys.some((key) => KNOWN_KEYS.has(key))) return raw;

  return { cards: raw };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/migrate-content-overrides.test.ts
```
Expected: PASS（6 个用例）

- [ ] **Step 5: 修改 store 的覆盖项结构与持久化钩子**

**5a.** 在 `apps/web-antd/src/store/kid.ts` 顶部补 import（放在 `import { getBindToken } from '#/utils/bind-token';` 之前）：

```ts
import { migrateContentOverrides } from '#/data/migrate-content-overrides';
```

**5b.** 把

```ts
    /** 家长中心对内置内容的覆盖项 */
    const contentOverrides = ref<Record<string, any>>({});
```

替换为

```ts
    /** 家长中心对内置内容的覆盖项：模块 key → 条目 id → patch */
    const contentOverrides = ref<Record<string, Record<string, any>>>({});
```

**5c.** 把文件末尾的 persist 配置

```ts
    persist: {
      pick: ['records', 'dailyGoals', 'screenLimitMin', 'contentOverrides'],
    },
```

替换为

```ts
    persist: {
      pick: ['records', 'dailyGoals', 'screenLimitMin', 'contentOverrides'],
      /**
       * 持久化数据在 store 创建后才注入，所以迁移必须挂在 afterHydrate，
       * 不能写在 setup 函数体里（那时读到的还是默认空对象）。
       * 迁移函数是幂等的，每次启动执行无副作用。
       */
      afterHydrate: (ctx) => {
        const state = ctx.store as unknown as { contentOverrides: unknown };
        state.contentOverrides = migrateContentOverrides(
          state.contentOverrides,
        );
      },
    },
```

> `afterHydrate` 是 pinia-plugin-persistedstate 4.x 的钩子名（**不是** `afterRestore`），运行时在 `hydrateStore()` 末尾无条件调用，已核对 4.7.1 的 `dist/index.js`。
>
> 迁移后不会立即写回 localStorage（`$subscribe` 在 hydrate 之后才注册），下次状态变更时自然落盘。因为迁移幂等，这不影响正确性。

- [ ] **Step 6: 修改 use-content.ts 的读写路径（暂不抽 useCollection）**

在 `apps/web-antd/src/data/use-content.ts` 中，把 `cards` computed 里的

```ts
  const cards = computed<KidCard[]>(() => {
    const overrides = kidStore.contentOverrides;
```

改为

```ts
  const cards = computed<KidCard[]>(() => {
    const overrides = kidStore.contentOverrides.cards ?? {};
```

把 `addCard` / `updateCard` / `deleteCard` 三处 `kidStore.contentOverrides[...]` 改为先取模块分组：

```ts
  function overridesOfCards() {
    kidStore.contentOverrides.cards ??= {};
    return kidStore.contentOverrides.cards;
  }

  function addCard(draft: CardDraft) {
    const id = `custom-${Date.now()}`;
    overridesOfCards()[id] = { ...draft, added: true };
  }

  function updateCard(id: string, patch: Partial<CardDraft>) {
    const base = kidCards.find((c) => c.id === id);
    overridesOfCards()[id] = { ...(base ?? {}), ...patch, added: !base };
  }

  function deleteCard(id: string) {
    const base = kidCards.find((c) => c.id === id);
    if (base) {
      overridesOfCards()[id] = { deleted: true };
    } else {
      delete overridesOfCards()[id];
    }
  }
```

- [ ] **Step 7: 类型检查 + 全量测试**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm test:unit
```
Expected: typecheck 无报错；测试全绿

- [ ] **Step 8: 手工验证旧数据迁移**

```bash
pnpm dev:antd
```
1. 打开浏览器 DevTools → Application → Local Storage，找到 key `kid`。
2. 把它的 `contentOverrides` 字段**手动改回扁平结构**，例如：
   ```json
   {"a1":{"emoji":"🐘","name":"大象（旧数据）","pinyin":"dà xiàng"}}
   ```
3. 刷新页面 → 进入家长中心 → 内容管理。
4. 确认第一行显示「大象（旧数据）」而不是内置的「大象」。
5. 再刷新一次，确认仍显示「大象（旧数据）」（迁移幂等，没被二次包裹成 `{cards:{cards:{...}}}`）。

- [ ] **Step 9: 提交**

```bash
git add apps/web-antd/src/data/migrate-content-overrides.ts apps/web-antd/src/data/__tests__/migrate-content-overrides.test.ts apps/web-antd/src/store/kid.ts apps/web-antd/src/data/use-content.ts
git commit -m "refactor(store): contentOverrides 改为按模块分组并迁移旧数据"
```

---

## Task 3: useCollection 泛化内容层

**Files:**
- Create: `apps/web-antd/src/data/use-collection.ts`
- Create: `apps/web-antd/src/data/__tests__/use-collection.test.ts`
- Modify: `apps/web-antd/src/data/use-content.ts`

**Interfaces:**
- Consumes: Task 1 的 `TileKey`；Task 2 的 store 覆盖项结构
- Produces:
  - `interface ContentItemBase { id: string }`
  - `type ContentPatch<T> = Partial<T> & { added?: boolean; deleted?: boolean }`
  - `interface CollectionConfig<T> { key: TileKey; defaults: T[]; validate?: (draft: Partial<T>) => string | undefined }`
  - `useCollection<T extends ContentItemBase>(config): { items: ComputedRef<T[]>; add(draft: Omit<T,'id'>): void; update(id, patch): void; remove(id): void }`

- [ ] **Step 1: 写失败测试**

创建 `apps/web-antd/src/data/__tests__/use-collection.test.ts`：

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// store/kid.ts 会在导入时拉取 #/api；这里只关心集合语义，故整体替换。
vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { useCollection } from '#/data/use-collection';

interface Item {
  id: string;
  name: string;
}

const DEFAULTS: Item[] = [
  { id: 'a1', name: '大象' },
  { id: 'a2', name: '兔子' },
];

function setup() {
  return useCollection<Item>({ defaults: DEFAULTS, key: 'cards' });
}

/** 通用集合：内置内容 + 家长覆盖项的合并、增改删 */
describe('useCollection', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('无覆盖项时返回内置内容', () => {
    expect(setup().items.value).toEqual(DEFAULTS);
  });

  it('可修改内置项', () => {
    const { items, update } = setup();
    update('a1', { name: '小象' });
    expect(items.value).toEqual([
      { id: 'a1', name: '小象' },
      { id: 'a2', name: '兔子' },
    ]);
  });

  it('可删除内置项，其余项与顺序不受影响', () => {
    const { items, remove } = setup();
    remove('a1');
    expect(items.value).toEqual([{ id: 'a2', name: '兔子' }]);
  });

  it('可新增自定义项并追加在末尾', () => {
    const { add, items } = setup();
    add({ name: '长颈鹿' });
    expect(items.value).toHaveLength(3);
    expect(items.value[2]?.name).toBe('长颈鹿');
    expect(items.value[2]?.id).toMatch(/^custom-/);
  });

  it('连续新增时 id 不重复', () => {
    const { add, items } = setup();
    add({ name: 'A' });
    add({ name: 'B' });
    const ids = items.value.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('删除自定义项后彻底移除，不留空壳', () => {
    const { add, items, remove } = setup();
    add({ name: '长颈鹿' });
    const id = items.value[2]!.id;
    remove(id);
    expect(items.value).toEqual(DEFAULTS);
  });

  it('修改内置项后再删除，删除生效', () => {
    const { items, remove, update } = setup();
    update('a1', { name: '小象' });
    remove('a1');
    expect(items.value).toEqual([{ id: 'a2', name: '兔子' }]);
  });

  it('不同模块的覆盖项彼此隔离', () => {
    const cards = useCollection<Item>({ defaults: DEFAULTS, key: 'cards' });
    const letters = useCollection<Item>({ defaults: DEFAULTS, key: 'letters' });
    cards.remove('a1');
    expect(cards.items.value).toHaveLength(1);
    expect(letters.items.value).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/use-collection.test.ts
```
Expected: FAIL — `Failed to resolve import "#/data/use-collection"`

- [ ] **Step 3: 实现 useCollection**

创建 `apps/web-antd/src/data/use-collection.ts`：

```ts
import type { ComputedRef } from 'vue';

import type { TileKey } from './modules';

import { computed } from 'vue';

import { useKidStore } from '#/store';

export interface ContentItemBase {
  id: string;
}

/** 家长中心对单个条目的覆盖：改字段 / 新增标记 / 删除标记 */
export type ContentPatch<T> = Partial<T> & {
  added?: boolean;
  deleted?: boolean;
};

export interface CollectionConfig<T extends ContentItemBase> {
  /** 覆盖项的命名空间，取模块 key */
  key: TileKey;
  /** 内置默认条目 */
  defaults: T[];
  /** 校验草稿；返回错误文案的 i18n 参数，通过则返回 undefined */
  validate?: (draft: Partial<T>) => string | undefined;
}

/**
 * 通用内容集合：内置内容与家长覆盖项合并后的响应式列表。
 *
 * 合并语义（与多模块改造前的卡片逻辑一致）：
 * 1. 遍历内置条目，`deleted` 的跳过，有 patch 的浅合并；
 * 2. 追加 `added` 的自定义条目，id 与内置项冲突时以已合并的内置项为准（不重复）。
 */
export function useCollection<T extends ContentItemBase>(
  config: CollectionConfig<T>,
): {
  add: (draft: Omit<T, 'id'>) => void;
  items: ComputedRef<T[]>;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<T>) => void;
} {
  const kidStore = useKidStore();

  function readOverrides(): Record<string, ContentPatch<T>> {
    return (kidStore.contentOverrides[config.key] ?? {}) as Record<
      string,
      ContentPatch<T>
    >;
  }

  function writeOverrides(): Record<string, ContentPatch<T>> {
    kidStore.contentOverrides[config.key] ??= {};
    return kidStore.contentOverrides[config.key] as Record<
      string,
      ContentPatch<T>
    >;
  }

  const items = computed<T[]>(() => {
    const overrides = readOverrides();
    const result: T[] = [];
    const builtinIds = new Set<string>();

    for (const item of config.defaults) {
      builtinIds.add(item.id);
      const patch = overrides[item.id];
      if (patch?.deleted) continue;
      result.push(patch ? { ...item, ...patch, id: item.id } : item);
    }

    for (const [id, patch] of Object.entries(overrides)) {
      if (patch?.added && !builtinIds.has(id)) {
        result.push({ ...patch, id } as T);
      }
    }

    return result;
  });

  function add(draft: Omit<T, 'id'>) {
    // 与 store 里学习记录 id 的生成方式一致，避免同毫秒内连续新增时碰撞
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    writeOverrides()[id] = { ...draft, added: true } as ContentPatch<T>;
  }

  function update(id: string, patch: Partial<T>) {
    const overrides = writeOverrides();
    const base = config.defaults.find((d) => d.id === id);
    overrides[id] = {
      ...(base ?? overrides[id] ?? {}),
      ...patch,
      added: !base,
    } as ContentPatch<T>;
  }

  function remove(id: string) {
    const overrides = writeOverrides();
    const base = config.defaults.find((d) => d.id === id);
    if (base) {
      overrides[id] = { deleted: true } as ContentPatch<T>;
    } else {
      delete overrides[id];
    }
  }

  return { add, items, remove, update };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/use-collection.test.ts
```
Expected: PASS（8 个用例）

- [ ] **Step 5: use-content.ts 改为基于 useCollection**

用以下内容整体替换 `apps/web-antd/src/data/use-content.ts`：

```ts
import type { KidCard, KidCategory, KidLetter, KidNumber, KidSong } from './content';
import type { TileKey } from './modules';

import { computed } from 'vue';

import {
  kidCards,
  kidCategories,
  kidLetters,
  kidNumbers,
  kidSongs,
} from './content';
import { useCollection } from './use-collection';

export type { KidCard, KidCategory, KidLetter, KidNumber, KidSong };

export interface CardDraft {
  categoryId: string;
  emoji: string;
  fact?: string;
  name: string;
  pinyin: string;
}

/**
 * 各模块的内置内容。
 * 新增内容型模块时在这里补一行，家长端内容管理即可管理它。
 */
const BUILTIN: Partial<Record<TileKey, { id: string }[]>> = {
  cards: kidCards,
};

/** 取某模块的内置内容；未注册的模块返回空数组（家长端显示空态，不报错） */
export function builtinOf(key: TileKey): { id: string }[] {
  return BUILTIN[key] ?? [];
}

/**
 * 内置内容 + 家长中心维护的覆盖项（增/改/删）合并后的响应式内容。
 *
 * 对外签名与多模块改造前保持一致，宝宝端与家长端调用方无需改动。
 */
export function useContent() {
  const cardCollection = useCollection<KidCard>({
    defaults: kidCards,
    key: 'cards',
  });

  const categories = computed<KidCategory[]>(() => [...kidCategories]);

  const cards = cardCollection.items;

  // letters / numbers 的数量限制由 Task 7 的「难度范围」引入，此处保持原语义
  const letters = computed<KidLetter[]>(() => [...kidLetters]);
  const numbers = computed<KidNumber[]>(() => [...kidNumbers]);

  const songs = computed<KidSong[]>(() => [...kidSongs]);

  function cardsByCategory(categoryId: string): KidCard[] {
    return cards.value.filter((c) => c.categoryId === categoryId);
  }

  function addCard(draft: CardDraft) {
    cardCollection.add(draft);
  }

  function updateCard(id: string, patch: Partial<CardDraft>) {
    cardCollection.update(id, patch);
  }

  function deleteCard(id: string) {
    cardCollection.remove(id);
  }

  return {
    addCard,
    cards,
    cardsByCategory,
    categories,
    deleteCard,
    letters,
    numbers,
    songs,
    updateCard,
  };
}
```

> 本步**不引入** `useKidStore` —— 卡片集合自己持有 store 引用，`letters` / `numbers` 此时不需要。Task 7 Step 5 会再加回 `useKidStore` 并把两者改成按难度范围 `slice`。

- [ ] **Step 6: 类型检查 + 全量测试**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm test:unit
```
Expected: typecheck 无报错；测试全绿

- [ ] **Step 7: 手工验证宝宝端与家长端卡片功能零回退**

```bash
pnpm dev:antd
```
1. 宝宝端「看图识物」：分类切换、点卡片朗读、考一考均正常。
2. 家长中心 → 内容管理：新增一张卡片 → 宝宝端能选到；编辑内置卡片 → 宝宝端显示新名称；删除 → 宝宝端不再出现。

- [ ] **Step 8: 提交**

```bash
git add apps/web-antd/src/data/use-collection.ts apps/web-antd/src/data/__tests__/use-collection.test.ts apps/web-antd/src/data/use-content.ts
git commit -m "refactor(data): 抽出 useCollection 通用集合，useContent 改为薄封装"
```

---

## Task 4: 每日目标回落注册表

**Files:**
- Modify: `apps/web-antd/src/store/kid.ts`
- Modify: `apps/web-antd/src/views/kid/rewards/index.vue`
- Modify: `apps/web-antd/src/views/parent/plan/index.vue`
- Create: `apps/web-antd/src/store/__tests__/goals.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `MODULES` / `MODULE_KEYS`
- Produces:
  - `dailyGoals: Partial<Record<LearnModule, number>>`
  - `goalOf(module: LearnModule): number`
  - store 对外 `LearnModule` / `MODULE_KEYS` 改为从 `#/data/modules` 再导出（调用方 import 路径不变）

- [ ] **Step 1: 写失败测试**

创建 `apps/web-antd/src/store/__tests__/goals.test.ts`：

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { MODULES } from '#/data/modules';
import { useKidStore } from '#/store';

/** 新增模块不会因为 dailyGoals 缺 key 而算出 undefined */
describe('每日目标回落', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('未配置时回落到注册表默认目标', () => {
    const kid = useKidStore();
    expect(kid.goalOf('cards')).toBe(MODULES.cards.defaultGoal);
    expect(kid.goalOf('letters')).toBe(MODULES.letters.defaultGoal);
    expect(kid.goalOf('numbers')).toBe(MODULES.numbers.defaultGoal);
    expect(kid.goalOf('songs')).toBe(MODULES.songs.defaultGoal);
  });

  it('家长配置后优先使用配置值，未配置的模块仍回落', () => {
    const kid = useKidStore();
    kid.dailyGoals = { cards: 3 };
    expect(kid.goalOf('cards')).toBe(3);
    expect(kid.goalOf('letters')).toBe(MODULES.letters.defaultGoal);
  });

  it('目标值始终为正整数，不会因缺 key 变成 undefined', () => {
    const kid = useKidStore();
    kid.dailyGoals = {};
    for (const module of ['cards', 'letters', 'numbers', 'songs'] as const) {
      const goal = kid.goalOf(module);
      expect(Number.isInteger(goal)).toBe(true);
      expect(goal).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/store/__tests__/goals.test.ts
```
Expected: FAIL — `kid.goalOf is not a function`

- [ ] **Step 3: 修改 store**

**3a.** `LearnModule` 与 `MODULE_KEYS` 改由注册表提供，从 `store/kid.ts` 再导出，调用方的 `from '#/store'` 路径不变。

把文件顶部第 9 行

```ts
export type LearnModule = 'cards' | 'letters' | 'numbers' | 'songs';
```

替换为

```ts
export type { LearnModule };
```

在 `import { submitLearnRecordApi, syncLearnRecordsApi } from '#/api';` 与 `import { getBindToken } from '#/utils/bind-token';` **之间**插入（保持路径字母序，符合 lint 的 import 排序规则）

```ts
import { type LearnModule, MODULE_KEYS, MODULES } from '#/data/modules';
```

再把文件中原有的这一段**整段删除**（否则与上面的 import 重复声明 `MODULE_KEYS`）：

```ts
export const MODULE_KEYS: LearnModule[] = [
  'cards',
  'letters',
  'numbers',
  'songs',
];
```

> `MODULE_KEYS` 现在是从 `#/data/modules` 导入的只读元组，`store` 只做再导出，不重新声明。

**3b.** 把每日目标初始值

```ts
    const dailyGoals = ref<Record<LearnModule, number>>({
      cards: 10,
      letters: 6,
      numbers: 6,
      songs: 2,
    });
```

替换为

```ts
    /** 家长配置的每日目标；未配置的模块由 goalOf() 回落到注册表默认值 */
    const dailyGoals = ref<Partial<Record<LearnModule, number>>>({});
```

**3c.** 在 `starsOf` 之后加：

```ts
    /** 每日目标：家长未配置时回落到注册表默认值，保证永远有值 */
    function goalOf(module: LearnModule): number {
      return dailyGoals.value[module] ?? MODULES[module].defaultGoal;
    }
```

**3d.** 在 `todayCountsOf` 里把显式四键初始化改为按 `MODULE_KEYS` 生成：

```ts
    function todayCountsOf(childId?: string): Record<LearnModule, number> {
      const counts = Object.fromEntries(
        MODULE_KEYS.map((key) => [key, 0]),
      ) as Record<LearnModule, number>;
      for (const r of todayRecordsOf(childId)) {
        if (counts[r.module as LearnModule] !== undefined) {
          counts[r.module as LearnModule] += 1;
        }
      }
      return counts;
    }
```

**3e.** 在 store 的 return 对象里按字母序补上 `goalOf`（放在 `contentOverrides` 与 `dailyGoals` 之间）。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/store/__tests__/goals.test.ts
```
Expected: PASS（3 个用例）

- [ ] **Step 5: 宝宝端奖励页改用注册表**

修改 `apps/web-antd/src/views/kid/rewards/index.vue`：

删除

```ts
const MODULE_EMOJI: Record<LearnModule, string> = {
  cards: '🐘',
  letters: '🔤',
  numbers: '🔢',
  songs: '🎵',
};
```

把 import 改为

```ts
import { MODULE_KEYS, MODULES, useKidStore } from '#/store';
```

> `LearnModule` 在本文件已无其他用途，一并从 import 中移除。

`tasks` computed 改为

```ts
const tasks = computed(() =>
  MODULE_KEYS.map((module) => {
    const count = todayCounts.value[module] ?? 0;
    const goal = kidStore.goalOf(module);
    return {
      count,
      done: count >= goal,
      emoji: MODULES[module].emoji,
      goal,
      module,
    };
  }),
);
```

- [ ] **Step 6: 家长端学习计划页改用 goalOf**

修改 `apps/web-antd/src/views/parent/plan/index.vue`：

删除

```ts
const MODULE_EMOJI: Record<LearnModule, string> = {
  cards: '🐘',
  letters: '🔤',
  numbers: '🔢',
  songs: '🎵',
};
```

`goals` 初始化改为

```ts
const goals = reactive<Record<LearnModule, number>>(
  Object.fromEntries(
    MODULE_KEYS.map((key) => [key, kidStore.goalOf(key)]),
  ) as Record<LearnModule, number>,
);
```

模板里的 `{{ MODULE_EMOJI[module] }}` 改为 `{{ MODULES[module].emoji }}`，import 补上 `MODULES`：

```ts
import { type LearnModule, MODULE_KEYS, MODULES, useKidStore } from '#/store';
```

- [ ] **Step 7: 类型检查 + 全量测试**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm test:unit
```
Expected: typecheck 无报错；测试全绿（含 Task 1–3 的测试）

- [ ] **Step 8: 手工验证每日任务零回退**

```bash
pnpm dev:antd
```
1. 宝宝端「我的星星」→ 今日任务的 emoji、模块名、`{count}/{goal}` 与改造前一致（应为 cards 0/10、letters 0/6、numbers 0/6、songs 0/2）。
2. 家长中心 → 学习计划 → 把「看图识物」目标改成 3 保存 → 宝宝端今日任务显示 `/3`。

- [ ] **Step 9: 提交**

```bash
git add apps/web-antd/src/store/kid.ts apps/web-antd/src/store/__tests__/goals.test.ts apps/web-antd/src/views/kid/rewards/index.vue apps/web-antd/src/views/parent/plan/index.vue
git commit -m "refactor(store): 每日目标改为部分配置 + 注册表回落"
```

---

## Task 5: 错题本 store 契约

**Files:**
- Modify: `apps/web-antd/src/store/kid.ts`
- Create: `apps/web-antd/src/store/__tests__/wrong-book.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `LearnModule`
- Produces:
  - `interface WrongItem { module: LearnModule; itemId: string; count: number; lastAt: number }`
  - `wrongBook: Record<string /* childId */, WrongItem[]>`
  - `addWrong(childId, module, itemId): void`
  - `removeWrong(childId, module, itemId): void`
  - `wrongOf(childId, module): WrongItem[]`
  - `clearWrong(childId, module?): void`

- [ ] **Step 1: 写失败测试**

创建 `apps/web-antd/src/store/__tests__/wrong-book.test.ts`：

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { useKidStore } from '#/store';

/**
 * 错题本：按孩子隔离，答错累加次数，答对移出。
 * 与 pinyin-vue 的「加入错题本 / 记住了移出」闭环对应。
 */
describe('错题本', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('初始为空', () => {
    const kid = useKidStore();
    expect(kid.wrongOf('child-a', 'pinyin' as never)).toEqual([]);
  });

  it('加入错题后可按模块查到', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    const list = kid.wrongOf('child-a', 'cards');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ count: 1, itemId: 'a1', module: 'cards' });
  });

  it('同一题重复答错累加次数而不是新增条目', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'cards', 'a1');
    const list = kid.wrongOf('child-a', 'cards');
    expect(list).toHaveLength(1);
    expect(list[0]?.count).toBe(2);
  });

  it('答对后移出错题本', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.removeWrong('child-a', 'cards', 'a1');
    expect(kid.wrongOf('child-a', 'cards')).toEqual([]);
  });

  it('不同模块的错题互不干扰', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'letters', 'A');
    expect(kid.wrongOf('child-a', 'cards')).toHaveLength(1);
    expect(kid.wrongOf('child-a', 'letters')).toHaveLength(1);
  });

  it('不同孩子的错题彼此隔离', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-b', 'cards', 'a2');
    expect(kid.wrongOf('child-a', 'cards').map((w) => w.itemId)).toEqual(['a1']);
    expect(kid.wrongOf('child-b', 'cards').map((w) => w.itemId)).toEqual(['a2']);
  });

  it('清空可按模块或整体', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'letters', 'A');
    kid.clearWrong('child-a', 'cards');
    expect(kid.wrongOf('child-a', 'cards')).toEqual([]);
    expect(kid.wrongOf('child-a', 'letters')).toHaveLength(1);
    kid.clearWrong('child-a');
    expect(kid.wrongOf('child-a', 'letters')).toEqual([]);
  });

  it('最新答错的排在最前', () => {
    const kid = useKidStore();
    kid.addWrong('child-a', 'cards', 'a1');
    kid.addWrong('child-a', 'cards', 'a2');
    expect(kid.wrongOf('child-a', 'cards').map((w) => w.itemId)).toEqual([
      'a2',
      'a1',
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/store/__tests__/wrong-book.test.ts
```
Expected: FAIL — `kid.addWrong is not a function`

- [ ] **Step 3: 实现错题本 store**

在 `apps/web-antd/src/store/kid.ts` 中：

**3a.** 在 `KidBadge` 接口之后新增类型：

```ts
export interface WrongItem {
  module: LearnModule;
  itemId: string;
  /** 累计答错次数 */
  count: number;
  lastAt: number;
}
```

**3b.** 在 `contentOverrides` 定义之后新增 state：

```ts
    /** 错题本：孩子 id → 错题列表 */
    const wrongBook = ref<Record<string, WrongItem[]>>({});
```

**3c.** 在 `clearRecords` 之前新增读写方法：

```ts
    /** 记一次答错；同一题累加次数并置顶 */
    function addWrong(childId: string, module: LearnModule, itemId: string) {
      const list = wrongBook.value[childId] ?? [];
      const existing = list.find(
        (w) => w.module === module && w.itemId === itemId,
      );
      const next: WrongItem = existing
        ? { ...existing, count: existing.count + 1, lastAt: Date.now() }
        : { count: 1, itemId, lastAt: Date.now(), module };
      wrongBook.value = {
        ...wrongBook.value,
        [childId]: [next, ...list.filter((w) => w !== existing)],
      };
    }

    /** 答对后移出错题本 */
    function removeWrong(childId: string, module: LearnModule, itemId: string) {
      const list = wrongBook.value[childId];
      if (!list) return;
      wrongBook.value = {
        ...wrongBook.value,
        [childId]: list.filter(
          (w) => !(w.module === module && w.itemId === itemId),
        ),
      };
    }

    /** 某模块的错题，最新答错的排在最前 */
    function wrongOf(childId: string, module: LearnModule): WrongItem[] {
      return (wrongBook.value[childId] ?? []).filter(
        (w) => w.module === module,
      );
    }

    /** 清空：传 module 只清该模块，不传则清空该孩子全部错题 */
    function clearWrong(childId: string, module?: LearnModule) {
      if (!wrongBook.value[childId]) return;
      wrongBook.value = {
        ...wrongBook.value,
        [childId]: module
          ? (wrongBook.value[childId] ?? []).filter((w) => w.module !== module)
          : [],
      };
    }
```

**3d.** 把现有的 `clearRecords` 整体替换为（同步清理该孩子的错题）：

```ts
    /** 清空某个孩子（或全部）的本机记录与错题本 */
    function clearRecords(childId?: string) {
      records.value = childId
        ? records.value.filter((r) => r.childId !== childId)
        : [];
      if (childId) {
        clearWrong(childId);
      } else {
        wrongBook.value = {};
      }
    }
```

> 不能写成 `clearWrong(childId ?? '')` —— `childId` 为 `undefined` 时那个空字符串不会命中任何 key，整体清空会失效。

**3e.** persist 的 `pick` 补上 `'wrongBook'`：

```ts
      pick: ['records', 'dailyGoals', 'screenLimitMin', 'contentOverrides', 'wrongBook'],
```

**3f.** 在 return 对象里按字母序补上 `addWrong`、`clearWrong`、`removeWrong`、`wrongBook`、`wrongOf`。

> 家庭成员删除孩子时会调 `clearRecords(childId)`（见 `store/family.ts`），因此删除孩子会自动清掉其错题本。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/store/__tests__/wrong-book.test.ts
```
Expected: PASS（8 个用例）

- [ ] **Step 5: 回归全量测试**

```bash
pnpm test:unit
```
Expected: 全绿，`relationship.test.ts` 中的「删除孩子清理本机记录」用例不受影响

- [ ] **Step 6: 提交**

```bash
git add apps/web-antd/src/store/kid.ts apps/web-antd/src/store/__tests__/wrong-book.test.ts
git commit -m "feat(store): 新增错题本数据结构与读写接口"
```

---

## Task 6: 家长端内容管理改为字段驱动

**Files:**
- Create: `apps/web-antd/src/views/parent/components/content-form-modal.vue`
- Modify: `apps/web-antd/src/views/parent/content/index.vue`
- Delete: `apps/web-antd/src/views/parent/components/card-form-modal.vue`
- Modify: `apps/web-antd/src/locales/langs/zh-CN/parent.json`
- Modify: `apps/web-antd/src/locales/langs/en-US/parent.json`

**Interfaces:**
- Consumes: Task 1 的 `MODULES` / `TILE_KEYS` / `FieldDef`；Task 3 的 `useCollection` / `builtinOf`
- Produces: 复用组件 `ContentFormModal`（props: `moduleKey`、`record?`；v-model:open；emit `submit`）

- [ ] **Step 1: 补 i18n 文案**

`apps/web-antd/src/locales/langs/zh-CN/parent.json` 的 `content` 对象里，在 `"deleteConfirm"` 之后添加：

```json
    "required": "请填写{field}",
    "modules": "学习模块"
```

`apps/web-antd/src/locales/langs/en-US/parent.json` 的 `content` 对象里，在 `"deleteConfirm"` 之后添加：

```json
    "required": "Please fill in {field}",
    "modules": "Learning modules"
```

> `content.required` 用于字段驱动表单的必填提示；`content.modules` 是 Tab 栏的无障碍标签。**不要**新增各字段的 label —— cards 用到的 `name` / `pinyin` / `emoji` / `category` / `fact` 两个语言包里都已存在，表单统一按 `parent.content.${labelKey}` 取用。

- [ ] **Step 2: 创建字段驱动表单**

创建 `apps/web-antd/src/views/parent/components/content-form-modal.vue`：

```vue
<script lang="ts" setup>
import type { FieldDef, TileKey } from '#/data/modules';

import { computed, reactive, watch } from 'vue';

import { Form, FormItem, Input, InputNumber, message, Modal, Select } from 'ant-design-vue';

import { MODULES } from '#/data/modules';
import { $t } from '#/locales';

/**
 * 字段驱动的家长端内容表单：
 * 字段与校验规则来自模块注册表的 fields 声明，一套代码覆盖所有内容型模块。
 */
const props = defineProps<{
  moduleKey: TileKey;
  /** 编辑时的现有值；新增时为 undefined */
  record?: Record<string, any>;
}>();

const emit = defineEmits<{ submit: [draft: Record<string, any>] }>();

const open = defineModel<boolean>('open', { default: false });

const fields = computed<FieldDef[]>(() => MODULES[props.moduleKey].fields ?? []);

/** 用 Record 而非固定形状：字段随模块而变 */
const form = reactive<Record<string, any>>({});

function defaultValueOf(field: FieldDef) {
  if (field.type === 'number') return 0;
  if (field.type === 'select') return field.options?.()[0]?.value ?? '';
  if (field.type === 'stringList') return [];
  return '';
}

watch(open, (value) => {
  if (!value) return;
  for (const field of fields.value) {
    form[field.key] = props.record?.[field.key] ?? defaultValueOf(field);
  }
});

function isEmpty(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  return !String(value ?? '').trim();
}

function submit() {
  for (const field of fields.value) {
    if (!field.required) continue;
    if (isEmpty(form[field.key])) {
      message.warning(
        $t('parent.content.required', {
          field: $t(`parent.content.${field.labelKey}`),
        }),
      );
      return;
    }
  }
  emit('submit', { ...form });
  open.value = false;
}
</script>

<template>
  <Modal
    v-model:open="open"
    :title="record ? $t('parent.common.edit') : $t('parent.common.add')"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem
        v-for="field in fields"
        :key="field.key"
        :label="$t(`parent.content.${field.labelKey}`)"
        :required="field.required"
      >
        <Select v-if="field.type === 'select'" v-model:value="form[field.key]">
          <Select.Option
            v-for="option in field.options?.() ?? []"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </Select.Option>
        </Select>

        <InputNumber
          v-else-if="field.type === 'number'"
          v-model:value="form[field.key]"
          class="w-full"
        />

        <Input.TextArea
          v-else-if="field.type === 'textarea'"
          v-model:value="form[field.key]"
          :maxlength="field.maxLength"
          :rows="2"
        />

        <Input
          v-else
          v-model:value="form[field.key]"
          :maxlength="field.maxLength"
          :placeholder="field.type === 'emoji' ? '🐘' : ''"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
```

> `stringList` 类型本计划用不到（留给子项目 #2 的拼音字表），因此这里不渲染 —— 遇到未知类型会落到最后的 `<Input>`，不会空白。

- [ ] **Step 3: 内容管理页改为模块 Tab**

用以下内容整体替换 `apps/web-antd/src/views/parent/content/index.vue`：

```vue
<script lang="ts" setup>
import type { ContentItemBase } from '#/data/use-collection';
import type { TileKey } from '#/data/modules';

import { computed, ref } from 'vue';

import { Button, message, Popconfirm, Table } from 'ant-design-vue';

import { MODULES, TILE_KEYS } from '#/data/modules';
import { builtinOf, useCollection } from '#/data/use-content';
import { $t } from '#/locales';

import ContentFormModal from '../components/content-form-modal.vue';

/** 只把内容型模块做成 Tab */
const contentModules = TILE_KEYS.filter((key) => MODULES[key].kind === 'content');

const activeModule = ref<TileKey>(contentModules[0]!);

const activeFields = computed(() => MODULES[activeModule.value].fields ?? []);

const collection = useCollection<ContentItemBase>({
  defaults: builtinOf(activeModule.value),
  key: activeModule.value,
});

const formOpen = ref(false);
const editingId = ref<string>();

const editingRecord = computed(() => {
  if (!editingId.value) return undefined;
  return collection.items.value.find((item) => item.id === editingId.value);
});

const columns = computed(() => [
  ...activeFields.value.map((field) => ({
    dataIndex: field.key,
    key: field.key,
    title: $t(`parent.content.${field.labelKey}`),
    width: field.type === 'emoji' ? 80 : undefined,
  })),
  { key: 'actions', title: $t('parent.content.actions'), width: 160 },
]);

function switchModule(key: TileKey) {
  activeModule.value = key;
  editingId.value = undefined;
  formOpen.value = false;
}

function openAdd() {
  editingId.value = undefined;
  formOpen.value = true;
}

function openEdit(id: string) {
  editingId.value = id;
  formOpen.value = true;
}

function submit(draft: Record<string, any>) {
  if (editingId.value) {
    collection.update(editingId.value, draft);
    message.success($t('parent.content.saved'));
  } else {
    collection.add(draft);
    message.success($t('parent.content.added'));
  }
}

function remove(id: string) {
  collection.remove(id);
  message.success($t('parent.content.deleted'));
}
</script>

<template>
  <div class="p-5">
    <div class="mb-4">
      <h2 class="text-lg font-bold">{{ $t('parent.content.title') }}</h2>
      <p class="text-muted-foreground text-sm">
        {{ $t('parent.content.tip') }}
      </p>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2" role="tablist" :aria-label="$t('parent.content.modules')">
        <Button
          v-for="key in contentModules"
          :key="key"
          :type="key === activeModule ? 'primary' : 'default'"
          role="tab"
          :aria-selected="key === activeModule"
          @click="switchModule(key)"
        >
          {{ MODULES[key].emoji }} {{ $t(`kid.modules.${key}`) }}
        </Button>
      </div>
      <Button type="primary" @click="openAdd">
        {{ $t('parent.content.add') }}
      </Button>
    </div>

    <Table
      :columns="columns"
      :data-source="collection.items.value"
      :pagination="{ pageSize: 10 }"
      row-key="id"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'emoji'">
          <span class="text-2xl">{{ record.emoji }}</span>
        </template>
        <template v-else-if="column.key === 'categoryId'">
          {{
            activeFields
              .find((f) => f.key === 'categoryId')
              ?.options?.()
              .find((o) => o.value === record.categoryId)?.label ?? record.categoryId
          }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <Button size="small" type="link" @click="openEdit(record.id)">
            {{ $t('parent.common.edit') }}
          </Button>
          <Popconfirm
            :title="$t('parent.content.deleteConfirm')"
            @confirm="remove(record.id)"
          >
            <Button danger size="small" type="link">
              {{ $t('parent.common.delete') }}
            </Button>
          </Popconfirm>
        </template>
      </template>
    </Table>

    <ContentFormModal
      v-model:open="formOpen"
      :module-key="activeModule"
      :record="editingRecord"
      @submit="submit"
    />
  </div>
</template>
```

> 列顺序为「字段列 + 操作列」，与改造前的固定列（名称 / 拼音 / 图标 / 分类 / 小知识 / 操作）一致。表格的 `#bodyCell` 里对 `emoji` 与 `categoryId` 做了特殊渲染，其余字段直接输出原值。

- [ ] **Step 4: 导出 useCollection 与 builtinOf**

确认 `apps/web-antd/src/data/use-content.ts` 已导出 `builtinOf`（Task 3 已加），并在文件里补一条再导出，让家长端可以从同一入口取到 `useCollection` 与类型：

```ts
export { useCollection } from './use-collection';
export type { ContentItemBase, ContentPatch } from './use-collection';
```

- [ ] **Step 5: 删除被替代的旧表单**

```bash
git rm apps/web-antd/src/views/parent/components/card-form-modal.vue
```

> 确认全仓已无引用：`grep -rn "card-form-modal" apps/` 应无输出。

- [ ] **Step 6: 类型检查 + i18n 校验 + 全量测试**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm -F @vben/web-antd run check:i18n
pnpm test:unit
```
Expected: 三项全过

- [ ] **Step 7: 手工验证卡片管理零回退**

```bash
pnpm dev:antd
```
进入家长中心 → 内容管理，确认：
1. 顶部出现「🐘 看图识物」Tab（当前只有一个内容型模块）。
2. 表格列为：名称 / 拼音 / 图标 / 分类 / 小知识 / 操作，与改造前一致。
3. 新增：不填名称点确定 → 提示「请填写名称」，不写入。
4. 新增：填名称 → 保存 → 列表出现，宝宝端「看图识物」可选到。
5. 编辑内置卡片 → 宝宝端显示新值。
6. 删除卡片 → 列表移除，宝宝端不再出现。

- [ ] **Step 8: 提交**

```bash
git add apps/web-antd/src/views/parent/components/content-form-modal.vue apps/web-antd/src/views/parent/content/index.vue apps/web-antd/src/locales/langs/zh-CN/parent.json apps/web-antd/src/locales/langs/en-US/parent.json apps/web-antd/src/data/use-content.ts
git commit -m "feat(parent): 内容管理改为模块 Tab + 字段驱动表单"
```

---

## Task 7: 家长端参数型模块开关与难度区间

**Files:**
- Modify: `apps/web-antd/src/store/kid.ts`
- Modify: `apps/web-antd/src/data/use-content.ts`
- Modify: `apps/web-antd/src/views/kid/home/index.vue`
- Modify: `apps/web-antd/src/views/parent/plan/index.vue`
- Modify: `apps/web-antd/src/locales/langs/zh-CN/parent.json`
- Modify: `apps/web-antd/src/locales/langs/en-US/parent.json`
- Create: `apps/web-antd/src/store/__tests__/module-settings.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `MODULES` / `TILE_KEYS`；Task 3 的 `useContent`
- Produces:
  - `interface ModuleSetting { enabled?: boolean; range?: number }`
  - `moduleSettings: Partial<Record<LearnModule, ModuleSetting>>`
  - `moduleEnabled(module: LearnModule): boolean`（默认 `true`）
  - `moduleRange(module: LearnModule): number`（无 `range` 定义时返回 `Infinity`）

- [ ] **Step 1: 写失败测试**

创建 `apps/web-antd/src/store/__tests__/module-settings.test.ts`：

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/api', () => ({
  submitLearnRecordApi: vi.fn(),
  syncLearnRecordsApi: vi.fn(),
}));

import { MODULES } from '#/data/modules';
import { useKidStore } from '#/store';

/** 参数型模块：默认启用、难度取注册表默认值，家长配置后以配置为准 */
describe('模块设置', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('未配置时默认启用', () => {
    const kid = useKidStore();
    expect(kid.moduleEnabled('cards')).toBe(true);
    expect(kid.moduleEnabled('letters')).toBe(true);
  });

  it('显式关闭后不再启用', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { enabled: false } };
    expect(kid.moduleEnabled('letters')).toBe(false);
    expect(kid.moduleEnabled('cards')).toBe(true);
  });

  it('难度范围未配置时回落到注册表默认值', () => {
    const kid = useKidStore();
    expect(kid.moduleRange('letters')).toBe(MODULES.letters.range!.default);
    expect(kid.moduleRange('numbers')).toBe(MODULES.numbers.range!.default);
  });

  it('家长配置后以配置为准', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { range: 8 } };
    expect(kid.moduleRange('letters')).toBe(8);
    expect(kid.moduleRange('numbers')).toBe(MODULES.numbers.range!.default);
  });

  it('无难度区间的模块返回 Infinity（不限制）', () => {
    const kid = useKidStore();
    expect(kid.moduleRange('cards')).toBe(Number.POSITIVE_INFINITY);
  });

  it('开关与范围可独立配置', () => {
    const kid = useKidStore();
    kid.moduleSettings = { letters: { range: 8 } };
    expect(kid.moduleEnabled('letters')).toBe(true);
    expect(kid.moduleRange('letters')).toBe(8);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/store/__tests__/module-settings.test.ts
```
Expected: FAIL — `kid.moduleEnabled is not a function`

- [ ] **Step 3: store 增加模块设置**

在 `apps/web-antd/src/store/kid.ts` 中：

**3a.** 在 `WrongItem` 之后新增类型：

```ts
/** 参数型模块的家长设置 */
export interface ModuleSetting {
  /** 关闭后宝宝端首页不显示该入口；默认启用 */
  enabled?: boolean;
  /** 难度范围：宝宝端只出现前 N 个条目 */
  range?: number;
}
```

**3b.** 在 `wrongBook` 之后新增 state：

```ts
    /** 参数型模块的家长设置 */
    const moduleSettings = ref<Partial<Record<LearnModule, ModuleSetting>>>({});
```

**3c.** 在 `goalOf` 之后新增读取方法：

```ts
    /** 模块是否启用；未配置视为启用 */
    function moduleEnabled(module: LearnModule): boolean {
      return moduleSettings.value[module]?.enabled !== false;
    }

    /** 模块难度范围；无 range 定义的模块返回 Infinity 表示不限制 */
    function moduleRange(module: LearnModule): number {
      const def = MODULES[module].range;
      if (!def) return Number.POSITIVE_INFINITY;
      return moduleSettings.value[module]?.range ?? def.default;
    }
```

**3d.** persist 的 `pick` 补上 `'moduleSettings'`：

```ts
      pick: [
        'records',
        'dailyGoals',
        'screenLimitMin',
        'contentOverrides',
        'wrongBook',
        'moduleSettings',
      ],
```

**3e.** 在 return 对象里按字母序补上 `moduleEnabled`、`moduleRange`、`moduleSettings`。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/store/__tests__/module-settings.test.ts
```
Expected: PASS（6 个用例）

- [ ] **Step 5: 宝宝端字母/数字数量跟随难度范围**

修改 `apps/web-antd/src/data/use-content.ts` 的 `letters` / `numbers`：

```ts
  /** 字母数量受家长端「难度范围」限制，学一学与考一考共用同一份数据 */
  const letters = computed<KidLetter[]>(() => {
    const limit = kidStore.moduleRange('letters');
    return kidLetters.slice(0, limit);
  });

  /** 数字数量受家长端「难度范围」限制 */
  const numbers = computed<KidNumber[]>(() => {
    const limit = kidStore.moduleRange('numbers');
    return kidNumbers.slice(0, limit);
  });
```

> Task 3 若已按提示写成这个最终形态，本步无改动。

- [ ] **Step 6: 宝宝端首页按开关过滤**

修改 `apps/web-antd/src/views/kid/home/index.vue`：

```ts
/** 首页磁贴由模块注册表派生，并过滤掉家长关闭的模块 */
const tiles = computed(() =>
  TILE_KEYS.map((key) => MODULES[key]).filter(
    (def) => !isLearnModule(def.key) || kidStore.moduleEnabled(def.key),
  ),
);
```

并在 import 中补上 `computed` 与判断函数。`isLearnModule` 定义在 `data/modules.ts`，需要在 Task 1 的文件里补上：

```ts
import { computed } from 'vue';

export function isLearnModule(key: TileKey): key is LearnModule {
  return (MODULE_KEYS as readonly string[]).includes(key);
}
```

> `rewards`（非学习入口）始终显示，不受模块开关影响。

- [ ] **Step 7: 家长端学习计划页加参数型模块区块**

修改 `apps/web-antd/src/views/parent/plan/index.vue`：

script 部分新增

```ts
/** 参数型模块设置（开关 + 难度区间） */
const paramModules = MODULE_KEYS.filter((key) => MODULES[key].kind === 'param');

const settings = reactive<
  Record<string, { enabled: boolean; range: number }>
>(
  Object.fromEntries(
    paramModules.map((key) => [
      key,
      {
        enabled: kidStore.moduleEnabled(key),
        range: kidStore.moduleRange(key),
      },
    ]),
  ),
);

function save() {
  kidStore.dailyGoals = { ...goals };
  kidStore.moduleSettings = Object.fromEntries(
    paramModules.map((key) => [
      key,
      { enabled: settings[key]!.enabled, range: settings[key]!.range },
    ]),
  );
  message.success($t('parent.common.saved'));
}
```

> 原来的 `save()` 一并被替换；`goals` 保持不变。

模板部分，在每日目标的 `Card` **之后**、护眼的 `Card` **之前**插入：

```vue
    <Card :title="$t('parent.plan.moduleTitle')">
      <div class="flex flex-col gap-5">
        <p class="text-muted-foreground text-sm">
          {{ $t('parent.plan.moduleTip') }}
        </p>
        <div
          v-for="key in paramModules"
          :key="key"
          class="flex flex-col gap-3 rounded-lg border border-solid p-4"
        >
          <div class="flex items-center justify-between">
            <span class="text-base">
              {{ MODULES[key].emoji }} {{ $t(`kid.modules.${key}`) }}
            </span>
            <Switch v-model:checked="settings[key]!.enabled" />
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm">{{ $t('parent.plan.rangeLabel') }}</span>
            <Slider
              v-model:value="settings[key]!.range"
              :disabled="!settings[key]!.enabled"
              :max="MODULES[key].range!.max"
              :min="MODULES[key].range!.min"
              class="flex-1"
            />
            <span class="w-16 text-right text-sm">
              {{
                $t('parent.plan.rangeHint', {
                  max: MODULES[key].range!.max,
                  min: MODULES[key].range!.min,
                  value: settings[key]!.range,
                })
              }}
            </span>
          </div>
        </div>
      </div>
    </Card>
```

import 补上 `Switch`、`MODULES`、`isLearnModule` 不需要。

> 卡片总数为 3 时，`grid gap-5 p-5 lg:grid-cols-2` 的左侧会变成 2 张卡。改用 `lg:grid-cols-2` 下三张卡会自动换行，视觉可接受；若希望护眼卡单独占满整行，给它的 `Card` 加 `class="lg:col-span-2"`。

- [ ] **Step 8: 补 i18n 文案**

`apps/web-antd/src/locales/langs/zh-CN/parent.json` 的 `plan` 对象里，在 `"screenAdvice"` 之后添加：

```json
    "moduleTitle": "模块与难度",
    "moduleTip": "关闭模块后宝宝端首页不再显示该入口；难度范围决定宝宝端出现的题目数量",
    "rangeLabel": "难度范围",
    "rangeHint": "{min}-{max}（当前 {value}）"
```

`apps/web-antd/src/locales/langs/en-US/parent.json` 的 `plan` 对象里，在 `"screenAdvice"` 之后添加：

```json
    "moduleTitle": "Modules & difficulty",
    "moduleTip": "A disabled module disappears from the kid home; the range controls how many items the kid sees",
    "rangeLabel": "Range",
    "rangeHint": "{min}-{max} (now {value})"
```

- [ ] **Step 9: 类型检查 + i18n 校验 + 全量测试**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm -F @vben/web-antd run check:i18n
pnpm test:unit
```
Expected: 三项全过

- [ ] **Step 10: 手工验证**

```bash
pnpm dev:antd
```
1. 家长中心 → 学习计划 → 新卡片「模块与难度」出现，含字母乐园与数字王国两项。
2. 把「数字王国」难度拉到 5 → 保存 → 宝宝端数字王国只出现 1-5。
3. 关闭「数字王国」开关 → 保存 → 宝宝端首页只剩 4 个磁贴（看图识物 / 字母乐园 / 儿歌点播 / 我的星星）。
4. 重新打开 → 磁贴恢复。
5. 刷新页面，设置保持（持久化生效）。

- [ ] **Step 11: 提交**

```bash
git add apps/web-antd/src/store/kid.ts apps/web-antd/src/store/__tests__/module-settings.test.ts apps/web-antd/src/data/modules.ts apps/web-antd/src/data/use-content.ts apps/web-antd/src/views/kid/home/index.vue apps/web-antd/src/views/parent/plan/index.vue apps/web-antd/src/locales/langs/zh-CN/parent.json apps/web-antd/src/locales/langs/en-US/parent.json
git commit -m "feat(parent): 学习计划支持参数型模块开关与难度区间"
```

---

## Task 8: 全量验收

**Files:**
- 无代码改动

- [ ] **Step 1: 跑完整检查**

```bash
pnpm -F @vben/web-antd run typecheck
pnpm -F @vben/web-antd run check:i18n
pnpm test:unit
```
Expected: 全部通过

- [ ] **Step 2: 逐条核对 spec §12 验收标准**

对照 `docs/superpowers/specs/2026-09-26-kid-modules-framework-design.md` 第 12 节，逐项手工验证：

- [ ] 宝宝端 5 个模块功能与样式零回退（看图识物 / 字母乐园 / 数字小屋 / 儿歌点播 / 我的星星）
- [ ] 首页磁贴数量、emoji、底色、文案、跳转与改造前一致（关闭模块开关时除外）
- [ ] 家长端内容管理对 cards 的增/改/删行为与改造前一致
- [ ] 带旧 `contentOverrides` 的 localStorage 进入应用，自定义卡片不丢失（Task 2 Step 8 已验，此处复验一次）
- [ ] 家长端学习计划页正常渲染每日目标、模块与难度、护眼设置

- [ ] **Step 3: 验证「注册一条配置即可扩展」**

临时在 `apps/web-antd/src/data/modules.ts` 的 `MODULE_KEYS` 末尾加 `'poems'`，`TILE_KEYS` 自动跟随，再补一条 `MODULES.poems` 配置（`bg: 'bg-rose-400'`、`kind: 'content'`、`defaultGoal: 1`、`path: '/kid/poems'`、`fields: [{ key: 'title', labelKey: 'name', required: true, type: 'text' }]`）。

启动应用确认：首页多出第 6 个磁贴、家长端内容管理多出「古诗花园」Tab、学习计划多出每日目标一项。

确认后**完整撤销**这次临时改动（`git checkout apps/web-antd/src/data/modules.ts`），再次启动确认无残留。

- [ ] **Step 4: 提交验收记录**

若 Step 2/3 发现问题并修复，单独提交；若全部通过则本 Task 无需提交，直接进入下一个子项目。

---

## 自查记录

**Spec 覆盖**

| spec 章节 | 对应 Task |
|---|---|
| §4 模块注册表 | Task 1 |
| §4.1 类型放置与循环依赖 | Task 1（注册表不依赖 store）、Task 4（`#/store` 再导出） |
| §5 内容层泛化 | Task 3 |
| §6 数据迁移 | Task 2 |
| §7 每日目标与参数型配置 | Task 4（目标回落）、Task 7（参数型配置） |
| §8.1 内容管理 | Task 6 |
| §8.2 学习计划 | Task 4（目标）、Task 7（参数型区块） |
| §8.3 首页磁贴 | Task 1（注册表化）、Task 7（按开关过滤） |
| §9 错题本 store 契约 | Task 5 |
| §10 错误处理 | Task 2（迁移不抛错）、Task 3（空 defaults 不报错）、Task 6（校验不写入） |
| §11 测试 | Task 1–5、7 各自的 Step 1 |
| §12 验收标准 | Task 8 |

**类型一致性**：`ContentItemBase`（Task 3 定义 → Task 6 使用）、`ContentPatch`（Task 3）、`builtinOf`（Task 3 定义 → Task 6 使用）、`TileKey` / `Moduledef` / `FieldDef`（Task 1 → Task 3/6/7）、`goalOf`（Task 4 → Task 4/7）、`moduleEnabled` / `moduleRange`（Task 7 定义 → Task 3 的 use-content 与 Task 7 的 home 使用）。Task 3 的 `use-content.ts` 提前引用 `moduleRange`，已在 Step 5 明确标注按顺序执行时的临时写法。

**已知取舍**：Task 1 的 `MODULES.cards.fields` 与删除前的 `card-form-modal.vue` 字段顺序一致（名称 / 拼音 / 图标 / 分类 / 小知识），保证家长端表单视觉零回退。Task 6 删除了 `card-form-modal.vue`，全仓无其他引用（Step 5 有 grep 校验）。
