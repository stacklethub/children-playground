# 儿童端 UI 现代化改造 · 第 1 部分：设计系统与学习岛 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立儿童端设计系统（令牌 + 原子组件 + 图标），并把首页从「3×3 网格 + 左侧边栏」改造成可探索的「学习岛」场景，同时保证 9 个内容页仍可正常访问。

**Architecture:** 调色板以 TS 为唯一事实源（内联 SVG 的 `fill` 需要真实色值），Tailwind `@theme` 令牌与之通过测试守一致性。岛上 9 个地点的坐标抽到独立数据表，组件只负责渲染。布局去掉常驻侧边栏，改由顶部 HUD 提供返回与家长入口 —— 导航重构与 HUD 必须同任务交付，否则内容页会失去入口。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript、Tailwind v4（CSS-first）、Vitest + happy-dom + `@vue/test-utils`、pnpm catalog

**规格来源：** `docs/superpowers/specs/2026-09-26-kid-ui-modernization-design.md`
**设计稿（对照验收）：** `docs/superpowers/specs/2026-09-26-kid-ui-modernization-mockup.html`

## Global Constraints

- **范围**：只改儿童端（`apps/web-antd/src/{layouts/kid.vue, layouts/components/kid/*, views/kid/*}`）。家长端零改动。
- **只改 UI 层**：`store/`、`api/`、`utils/tts*`、`data/content.ts` 一律不动。
- **路由不变量**：`/kid/*` 的 `path` 与 `name` 全部保持原样，只改入口形态。
- **动画只用 `transform` 与 `opacity`**：禁止动画 `width` / `height` / `top` / `left` / `margin` / `padding`。
- **必须支持 `prefers-reduced-motion: reduce`**：命中时停止全部循环动画。不是可选项 —— 主要使用场景是低端平板。
- **环境动画周期必须错开**：同类元素不得使用同周期同延迟，避免「整屏一起动」。
- **单屏常驻循环动画节点 ≤ 30**。
- **字体只用 SIL OFL 1.1**：霞鹜文楷 + Baloo 2。阿里妈妈方圆体明文禁止「拆分、修改」，禁用。
- **Tailwind 为 v4 CSS-first**：令牌写在 `internal/tailwind-config/src/theme.css` 的 `@theme` 块内，**不新增 `tailwind.config.js`**。
- **提交信息**：conventional commits，scope 必须属于 commitlint 允许列表 —— 本计划统一用 `@vben/web-antd`。
- **测试命令**：`pnpm test:unit`（根目录，Vitest + happy-dom）。类型检查：`pnpm check:type`。
- **无 Playwright**：`apps/web-antd` 未配置 E2E/视觉回归。本计划所有验收靠单元测试 + 手动浏览器确认。

---

## File Structure

**新建**

| 文件 | 职责 |
| --- | --- |
| `apps/web-antd/src/data/kid-palette.ts` | 调色板与模块主题色的唯一事实源（TS） |
| `apps/web-antd/src/data/__tests__/kid-palette.test.ts` | 守护「调色板 ↔ CSS 令牌」一致性 |
| `apps/web-antd/src/views/kid/components/kid-button.vue` | 厚底按钮 |
| `apps/web-antd/src/views/kid/components/kid-card.vue` | 木牌卡外壳 |
| `apps/web-antd/src/views/kid/components/kid-tabs.vue` | 胶囊 Tab（重写，合并旧 kid-tabs / mode-tabs） |
| `apps/web-antd/src/views/kid/components/kid-hud.vue` | 顶部 HUD：头像 / 问候 / 星星 / 返回 |
| `apps/web-antd/src/views/kid/components/icons/index.ts` | 图标桶文件 |
| `apps/web-antd/src/views/kid/components/icons/kid-icon.vue` | 通用图标外壳（统一 viewBox 与描边） |
| `apps/web-antd/src/views/kid/components/icons/spot-*.vue` | 9 个地点图标 |
| `apps/web-antd/src/data/island-spots.ts` | 模块 → 岛上坐标的映射表 |
| `apps/web-antd/src/data/__tests__/island-spots.test.ts` | 坐标完整性与不越界校验 |
| `apps/web-antd/src/views/kid/components/kid-spot.vue` | 岛上一个地点（图标 + 悬浮 + 名字牌） |
| `apps/web-antd/src/views/kid/components/kid-island.vue` | 整块岛场景（含天空/海/岛/装饰） |
| `apps/web-antd/src/views/kid/components/__tests__/*.test.ts` | 组件契约测试 |

**修改**

| 文件 | 改动 |
| --- | --- |
| `internal/tailwind-config/src/theme.css` | 追加 kid `@theme` 令牌块 |
| `package.json`（根） | devDependencies 加 `"@vue/test-utils": "catalog:"` |
| `apps/web-antd/src/layouts/kid.vue` | 去侧边栏，挂 HUD，接入字体 |
| `apps/web-antd/src/views/kid/home/index.vue` | 换成学习岛 |
| `apps/web-antd/src/bootstrap.ts` | 引入字体 CSS |

**删除**

| 文件 | 原因 |
| --- | --- |
| `apps/web-antd/src/layouts/components/kid/kid-side-menu.vue` | 导航重构后不再需要 |

> **不在本部分**：`views/kid/components/{kid-tabs,mode-tabs,kid-page,option-grid,star-toast,bind-guard,progress-dots}.vue` 的迁移、9 个内容页改造、吉祥物、奖励动效 —— 属第 2 部分。
> 但注意：本部分 Task 3 会**重写** `kid-tabs.vue` 并删除 `mode-tabs.vue`，因此 Task 3 必须同时更新其现有调用方，否则会留下编译错误（详见该任务）。

---

## Task 1: 调色板事实源 + Tailwind 设计令牌

**Files:**
- Create: `apps/web-antd/src/data/kid-palette.ts`
- Create: `apps/web-antd/src/data/__tests__/kid-palette.test.ts`
- Modify: `internal/tailwind-config/src/theme.css`（文件末尾追加）
- Modify: `package.json`（根，devDependencies）

**Interfaces:**
- Produces:
  - `KID_PALETTE: Record<KidColorName, string>` —— 15 个色值常量
  - `KidColorName` —— `keyof typeof KID_PALETTE`
  - `KID_MODULE_COLOR: Record<TileKey, KidColorName>` —— 9 个入口的主题色
  - Tailwind 可用类名：`bg-kid-*` / `text-kid-*` / `border-kid-*`、`rounded-kid-card`、`rounded-kid-pill`、`shadow-kid-hard`、`shadow-kid-soft`、`ease-kid-pop`
- Consumes: `TILE_KEYS`（来自 `apps/web-antd/src/data/modules.ts`，已存在）

- [ ] **Step 1: 加入组件测试依赖**

编辑根 `package.json`，在 `devDependencies` 里按字母序插入一行：

```json
"@vue/test-utils": "catalog:",
```

然后安装：

```bash
pnpm install
```

预期：安装成功，`node_modules/@vue/test-utils` 出现。`@vue/test-utils@^2.4.11` 已在 `pnpm-workspace.yaml` 的 catalog 中（`packages/@core/ui-kit/form-ui` 已在用），无需新增 catalog 条目。

- [ ] **Step 2: 写失败的测试**

创建 `apps/web-antd/src/data/__tests__/kid-palette.test.ts`：

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { KID_MODULE_COLOR, KID_PALETTE } from '../kid-palette';
import { TILE_KEYS } from '../modules';

/**
 * Tailwind 的 kid 设计令牌写在共享主题文件里，而色值的**事实源**是
 * 本目录的 kid-palette.ts（内联 SVG 的 fill 需要真实色值，拿不到 CSS 变量）。
 * 两份数据天然会漂移，这个测试就是防漂移的锁。
 */
const themeCss = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../internal/tailwind-config/src/theme.css',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('kidPalette', () => {
  it('9 个入口全部有主题色，不多不少', () => {
    expect(Object.keys(KID_MODULE_COLOR).sort()).toEqual([...TILE_KEYS].sort());
  });

  it('每个主题色都指向调色板里真实存在的颜色', () => {
    for (const name of Object.values(KID_MODULE_COLOR)) {
      expect(KID_PALETTE[name]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('CSS 令牌与调色板逐一对应', () => {
    for (const [name, hex] of Object.entries(KID_PALETTE)) {
      const kebab = name.replaceAll(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(themeCss).toContain(`--color-kid-${kebab}: ${hex};`);
    }
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/kid-palette.test.ts
```

预期：FAIL —— `Failed to resolve import "../kid-palette"`。

- [ ] **Step 4: 创建调色板**

创建 `apps/web-antd/src/data/kid-palette.ts`：

```ts
import type { TileKey } from './modules';

/**
 * 儿童端调色板 —— **唯一事实源**。
 *
 * 为什么事实源在 TS 而不是 CSS：岛上的场景与 9 个地点图标是内联 SVG，
 * `fill` / `stroke` 属性吃不到 CSS 变量，且 JS 侧还要用色值做派生计算。
 * CSS 令牌（`internal/tailwind-config/src/theme.css`）由
 * `__tests__/kid-palette.test.ts` 守住与本文件一致。
 *
 * 选色原则：描边用暖棕而非纯黑（整屏不「硬」），底色走奶油纸感而非纯白，
 * 强调色低饱和 —— 3-5 岁幼儿长时间注视，高饱和撞色容易疲劳。
 */
export const KID_PALETTE = {
  ink: '#4A3F35',
  inkSoft: '#9A8877',
  paper: '#FFFDF7',
  cream: '#F5E3C6',
  coral: '#E8756B',
  apricot: '#F0A868',
  sun: '#FFD98E',
  leaf: '#8FC98A',
  leafDark: '#7FB87C',
  sky: '#5B8DB8',
  blush: '#E8A0B4',
  lilac: '#D5CFEA',
  sea: '#6BBBD8',
  berry: '#B98A5E',
  gold: '#FFB100',
} as const;

export type KidColorName = keyof typeof KID_PALETTE;

/** 模块入口 → 主题色。9 个入口全覆盖（含非学习入口 rewards）。 */
export const KID_MODULE_COLOR: Record<TileKey, KidColorName> = {
  cards: 'apricot',
  letters: 'sky',
  pinyin: 'coral',
  poems: 'leaf',
  logic: 'sun',
  adventure: 'berry',
  numbers: 'lilac',
  songs: 'blush',
  rewards: 'gold',
};
```

- [ ] **Step 5: 追加 Tailwind 令牌**

在 `internal/tailwind-config/src/theme.css` **文件末尾**追加（不要动已有的 `@theme` 块）：

```css
/* ===== 儿童端（kid）设计令牌 =====
 * 色值事实源：apps/web-antd/src/data/kid-palette.ts
 * 一致性由 apps/web-antd/src/data/__tests__/kid-palette.test.ts 守住。
 */
@theme {
  --color-kid-ink: #4A3F35;
  --color-kid-ink-soft: #9A8877;
  --color-kid-paper: #FFFDF7;
  --color-kid-cream: #F5E3C6;
  --color-kid-coral: #E8756B;
  --color-kid-apricot: #F0A868;
  --color-kid-sun: #FFD98E;
  --color-kid-leaf: #8FC98A;
  --color-kid-leaf-dark: #7FB87C;
  --color-kid-sky: #5B8DB8;
  --color-kid-blush: #E8A0B4;
  --color-kid-lilac: #D5CFEA;
  --color-kid-sea: #6BBBD8;
  --color-kid-berry: #B98A5E;
  --color-kid-gold: #FFB100;

  --radius-kid-card: 26px;
  --radius-kid-pill: 999px;

  --shadow-kid-hard: 4px 4px 0 #4A3F35;
  --shadow-kid-soft: 0 10px 30px rgb(74 63 53 / 14%);

  --ease-kid-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 时长不进 @theme（Tailwind 无此时长命名空间），用普通自定义属性 */
:root {
  --kid-dur-fast: 120ms;
  --kid-dur-base: 220ms;
  --kid-dur-enter: 620ms;
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/kid-palette.test.ts
```

预期：PASS，3 个用例全绿。

- [ ] **Step 7: 提交**

```bash
git add package.json pnpm-lock.yaml apps/web-antd/src/data/kid-palette.ts apps/web-antd/src/data/__tests__/kid-palette.test.ts internal/tailwind-config/src/theme.css
git commit -m "feat(@vben/web-antd): 新增儿童端调色板事实源与 Tailwind 设计令牌"
```

---

## Task 2: 原子组件 —— KidButton 与 KidCard

**Files:**
- Create: `apps/web-antd/src/views/kid/components/kid-button.vue`
- Create: `apps/web-antd/src/views/kid/components/kid-card.vue`
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-button.test.ts`
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-card.test.ts`

**Interfaces:**
- Consumes: Task 1 的 Tailwind 类名（`rounded-kid-pill` / `shadow-kid-hard` / `bg-kid-apricot` 等）
- Produces:
  - `KidButton` —— props `{ variant?: 'ghost' | 'primary'; disabled?: boolean }`（默认 `'primary'` / `false`），emit `tap: []`，默认插槽为按钮文案
  - `KidCard` —— props `{ padded?: boolean }`（默认 `true`），默认插槽为卡片内容

- [ ] **Step 1: 写 KidButton 失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-button.test.ts`：

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import KidButton from '../kid-button.vue';

describe('kidButton', () => {
  it('点击时派发 tap 事件', async () => {
    const wrapper = mount(KidButton, { slots: { default: '下一个' } });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('tap')).toHaveLength(1);
  });

  it('disabled 时点击不派发 tap', async () => {
    const wrapper = mount(KidButton, {
      props: { disabled: true },
      slots: { default: '下一个' },
    });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('tap')).toBeUndefined();
  });

  it('默认用主色，variant=ghost 时改用纸白', () => {
    const primary = mount(KidButton, { slots: { default: 'x' } });
    expect(primary.get('button').classes()).toContain('bg-kid-apricot');

    const ghost = mount(KidButton, {
      props: { variant: 'ghost' },
      slots: { default: 'x' },
    });
    expect(ghost.get('button').classes()).toContain('bg-kid-paper');
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-button.test.ts
```

预期：FAIL —— `Failed to resolve import "../kid-button.vue"`。

- [ ] **Step 3: 实现 KidButton**

创建 `apps/web-antd/src/views/kid/components/kid-button.vue`：

```vue
<script setup lang="ts">
/**
 * 宝宝端厚底按钮。
 *
 * 手感来自设计令牌：3px 暖棕描边 + 硬投影。按下时按钮「沉」进投影里
 * （位移量等于投影偏移、同时抹掉投影），这是整套视觉最核心的触感反馈，
 * 替代了成人 UI 里常见的颜色变暗。
 */
withDefaults(
  defineProps<{
    disabled?: boolean;
    variant?: 'ghost' | 'primary';
  }>(),
  { disabled: false, variant: 'primary' },
);

const emit = defineEmits<{ tap: [] }>();
</script>

<template>
  <button
    class="kid-btn inline-flex items-center justify-center gap-2 rounded-kid-pill border-kid-ink px-7 text-xl font-black shadow-kid-hard transition-transform duration-[120ms] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
    :class="
      variant === 'primary'
        ? 'bg-kid-apricot text-white'
        : 'bg-kid-paper text-kid-ink'
    "
    :disabled="disabled"
    type="button"
    @click="emit('tap')"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
/* Tailwind 无 border-3 预设，用令牌统一描边宽度 */
.kid-btn {
  border-width: 3px;
  min-height: 64px;
}
</style>
```

> `min-height: 64px` 是硬要求：3-5 岁手指落点精度低，规格规定可点区域 ≥ 64×64px。

- [ ] **Step 4: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-button.test.ts
```

预期：PASS，3 个用例全绿。

- [ ] **Step 5: 写 KidCard 失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-card.test.ts`：

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import KidCard from '../kid-card.vue';

describe('kidCard', () => {
  it('渲染默认插槽内容', () => {
    const wrapper = mount(KidCard, { slots: { default: '字母 A' } });
    expect(wrapper.text()).toContain('字母 A');
  });

  it('默认带内边距，padded=false 时去掉', () => {
    const padded = mount(KidCard, { slots: { default: 'x' } });
    expect(padded.get('section').classes()).toContain('p-6');

    const bare = mount(KidCard, {
      props: { padded: false },
      slots: { default: 'x' },
    });
    expect(bare.get('section').classes()).not.toContain('p-6');
  });
});
```

- [ ] **Step 6: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-card.test.ts
```

预期：FAIL —— `Failed to resolve import "../kid-card.vue"`。

- [ ] **Step 7: 实现 KidCard**

创建 `apps/web-antd/src/views/kid/components/kid-card.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue';

/**
 * 木牌卡外壳。
 *
 * 存在的意义是消灭重复：改造前 `rounded-[3rem] bg-white/95 shadow-2xl`
 * 在 8 个文件里各写一遍，改一次要动 8 处。
 */
const props = withDefaults(defineProps<{ padded?: boolean }>(), {
  padded: true,
});

const classes = computed(() => (props.padded ? 'p-6' : 'p-0'));
</script>

<template>
  <section
    class="kid-card relative rounded-kid-card border-kid-ink bg-kid-paper shadow-kid-hard"
    :class="classes"
  >
    <slot></slot>
  </section>
</template>

<style scoped>
.kid-card {
  border-width: 3px;
}
</style>
```

- [ ] **Step 8: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-card.test.ts
```

预期：PASS，2 个用例全绿。

- [ ] **Step 9: 提交**

```bash
git add apps/web-antd/src/views/kid/components/kid-button.vue apps/web-antd/src/views/kid/components/kid-card.vue apps/web-antd/src/views/kid/components/__tests__/kid-button.test.ts apps/web-antd/src/views/kid/components/__tests__/kid-card.test.ts
git commit -m "feat(@vben/web-antd): 新增宝宝端原子组件 KidButton 与 KidCard"
```

---

## Task 3: 重写 KidTabs，合并并删除 ModeTabs

**Files:**
- Modify: `apps/web-antd/src/views/kid/components/kid-tabs.vue`（整体重写）
- Delete: `apps/web-antd/src/views/kid/components/mode-tabs.vue`
- Modify: `apps/web-antd/src/views/kid/letters/index.vue`、`numbers/index.vue`、`pinyin/index.vue`、`cards/index.vue`（改用新 API）
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-tabs.test.ts`

**Interfaces:**
- Consumes: Task 1 Tailwind 令牌
- Produces: `KidTabs` —— props `{ items: Array<{ label: string; value: string }>; accent?: KidColorName }`（`accent` 默认 `'sky'`），`v-model` 双向绑定当前选中值（`string`），emit `change: [value: string]`

**背景**：现状有两个组件在做同一件事 —— `kid-tabs.vue`（下拉式模块内 Tab）与 `mode-tabs.vue`（`learn` / `quiz` 二选一胶囊）。合并成一个受控组件。

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-tabs.test.ts`：

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import KidTabs from '../kid-tabs.vue';

const ITEMS = [
  { label: '认字母', value: 'learn' },
  { label: '考一考', value: 'quiz' },
];

describe('kidTabs', () => {
  it('渲染全部选项', () => {
    const wrapper = mount(KidTabs, { props: { items: ITEMS, modelValue: 'learn' } });
    expect(wrapper.findAll('button')).toHaveLength(2);
    expect(wrapper.text()).toContain('考一考');
  });

  it('点击未选中项时更新 modelValue 并派发 change', async () => {
    const wrapper = mount(KidTabs, { props: { items: ITEMS, modelValue: 'learn' } });
    await wrapper.findAll('button')[1]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['quiz']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['quiz']);
  });

  it('点击已选中项不派发事件', async () => {
    const wrapper = mount(KidTabs, { props: { items: ITEMS, modelValue: 'learn' } });
    await wrapper.findAll('button')[0]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('选中项带上主题色类，未选中不带', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'quiz', accent: 'coral' },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons[1]!.classes()).toContain('bg-kid-coral');
    expect(buttons[0]!.classes()).not.toContain('bg-kid-coral');
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-tabs.test.ts
```

预期：FAIL —— 现有 `kid-tabs.vue` 的 props 是 `labels` 而非 `items`，第一个用例即失败。

- [ ] **Step 3: 重写 KidTabs**

用以下内容**整体覆盖** `apps/web-antd/src/views/kid/components/kid-tabs.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue';

import type { KidColorName } from '#/data/kid-palette';

/**
 * 模块内 Tab 胶囊。
 *
 * 由旧的 kid-tabs（模块内多 Tab）与 mode-tabs（learn/quiz 二选一）合并而来 ——
 * 两者本是同一个控件，分家导致样式各写一份、行为不一致。
 *
 * accent 用显式映射而非模板字符串拼接：Tailwind 靠扫描源码生成类名，
 * 动态拼出的 `bg-kid-${accent}` 不会被扫描到，运行时样式会丢。
 */
const props = withDefaults(
  defineProps<{
    accent?: KidColorName;
    items: Array<{ label: string; value: string }>;
  }>(),
  { accent: 'sky' },
);

const ACCENT_CLASS: Partial<Record<KidColorName, string>> = {
  apricot: 'bg-kid-apricot',
  berry: 'bg-kid-berry',
  blush: 'bg-kid-blush',
  coral: 'bg-kid-coral',
  gold: 'bg-kid-gold',
  leaf: 'bg-kid-leaf',
  lilac: 'bg-kid-lilac',
  sky: 'bg-kid-sky',
  sun: 'bg-kid-sun',
};

const accentClass = computed(() => ACCENT_CLASS[props.accent] ?? 'bg-kid-sky');

const model = defineModel<string>({ required: true });
const emit = defineEmits<{ change: [value: string] }>();

function pick(value: string) {
  if (value === model.value) return;
  model.value = value;
  emit('change', value);
}
</script>

<template>
  <div
    class="mb-6 flex w-max gap-2 rounded-kid-pill border-kid-ink bg-kid-paper p-1.5 shadow-kid-hard"
  >
    <button
      v-for="item in items"
      :key="item.value"
      class="kid-tab rounded-kid-pill px-6 font-black transition-colors duration-[220ms]"
      :class="
        model === item.value
          ? `${accentClass} text-white`
          : 'bg-transparent text-kid-ink-soft'
      "
      type="button"
      @click="pick(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.kid-tab {
  border-width: 0;
  min-height: 56px;
}
</style>
```

- [ ] **Step 4: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-tabs.test.ts
```

预期：PASS，4 个用例全绿。

- [ ] **Step 5: 迁移现有调用方**

先用下面命令找出所有引用点：

```bash
grep -rn "kid-tabs\|KidTabs\|mode-tabs\|ModeTabs" apps/web-antd/src --include=*.vue
```

对每个引用文件按同一条规则改造：

- 旧 `<KidTabs :labels="..." :active-class="..." />` → `<KidTabs v-model="<当前模式变量>" :items="[...]" :accent="'<模块主题色>'" />`，其中 `items` 由原来的 `labels` 展开为 `{ label, value }` 数组
- 旧 `<ModeTabs v-model:mode="mode" :labels="{ learn, quiz }" />` → `<KidTabs v-model="mode" :items="[{ label: learn, value: 'learn' }, { label: quiz, value: 'quiz' }]" :accent="'<模块主题色>'" @change="<原有 handler>" />`

各模块主题色（取自 Task 1 的 `KID_MODULE_COLOR`）：letters → `sky`，numbers → `lilac`，pinyin → `coral`，cards → `apricot`，poems → `leaf`，logic → `sun`，songs → `blush`。

删掉文件顶部随之不再使用的 import。

- [ ] **Step 6: 删除 ModeTabs**

```bash
git rm apps/web-antd/src/views/kid/components/mode-tabs.vue
```

- [ ] **Step 7: 类型检查与全量单测**

```bash
pnpm check:type && pnpm test:unit
```

预期：两者均通过。若有残留引用，`vue-tsc` 会报 `Cannot find module '../components/mode-tabs.vue'` —— 回到 Step 5 补完。

- [ ] **Step 8: 提交**

```bash
git add apps/web-antd/src/views/kid/components/kid-tabs.vue apps/web-antd/src/views/kid/components/__tests__/kid-tabs.test.ts apps/web-antd/src/views/kid/letters/index.vue apps/web-antd/src/views/kid/numbers/index.vue apps/web-antd/src/views/kid/pinyin/index.vue apps/web-antd/src/views/kid/cards/index.vue
git commit -m "refactor(@vben/web-antd): 合并 KidTabs 与 ModeTabs 为单一受控组件"
```

---

## Task 4: 模块图标集（自绘内联 SVG）

**Files:**
- Create: `apps/web-antd/src/views/kid/components/icons/kid-icon.vue`
- Create: `apps/web-antd/src/views/kid/components/icons/spot-cards.vue`（帐篷·看图识物）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-letters.vue`（ABC 积木·英文乐园）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-pinyin.vue`（汉字书屋·中文乐园）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-poems.vue`（卷轴树·古诗花园）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-logic.vue`（齿轮工坊·逻辑挑战）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-adventure.vue`（火箭·闯关冒险）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-numbers.vue`（城堡·数字王国）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-songs.vue`（音乐舞台·儿歌点播）
- Create: `apps/web-antd/src/views/kid/components/icons/spot-rewards.vue`（宝箱·我的星星）
- Create: `apps/web-antd/src/views/kid/components/icons/__tests__/icons.test.ts`

**Interfaces:**
- Consumes: `KID_PALETTE`（Task 1）
- Produces:
  - `KidIcon` —— props `{ size?: number }`（默认 `96`），默认插槽为 `<svg>` 内容，统一 `viewBox="0 0 100 100"` 与 `stroke-width="3"`
  - 9 个图标组件，均为无 props 的纯展示组件
  - **9 个图标的内部坐标必须落在 `0 0 100 100` 视口内**，以保证 `KidIcon` 的统一缩放成立

> **色值为什么写死不用 CSS 变量**：SVG 的 `fill` / `stroke` 属性不接受 `var()`（只有 CSS 属性形式才接受）。设计稿里已验证过这一点。

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/views/kid/components/icons/__tests__/icons.test.ts`：

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TILE_KEYS } from '#/data/modules';

const ICON_BY_TILE = {
  adventure: 'spot-adventure',
  cards: 'spot-cards',
  letters: 'spot-letters',
  logic: 'spot-logic',
  numbers: 'spot-numbers',
  pinyin: 'spot-pinyin',
  poems: 'spot-poems',
  rewards: 'spot-rewards',
  songs: 'spot-songs',
} as const;

const read = (file: string) =>
  readFileSync(
    fileURLToPath(new URL(`../${file}.vue`, import.meta.url)),
    'utf8',
  );

describe('模块图标', () => {
  it('9 个入口各有一个图标文件', () => {
    expect(Object.keys(ICON_BY_TILE).sort()).toEqual([...TILE_KEYS].sort());
  });

  it('每个图标都用 100x100 视口，保证统一缩放', () => {
    for (const file of Object.values(ICON_BY_TILE)) {
      expect(read(file)).toContain('viewBox="0 0 100 100"');
    }
  });

  it('每个图标都用了暖棕描边而不是纯黑', () => {
    for (const file of Object.values(ICON_BY_TILE)) {
      expect(read(file)).not.toMatch(/#000|black/i);
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/icons/__tests__/icons.test.ts
```

预期：FAIL —— 图标文件不存在（`ENOENT`）。

- [ ] **Step 3: 实现 KidIcon 外壳**

创建 `apps/web-antd/src/views/kid/components/icons/kid-icon.vue`：

```vue
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
    <g stroke="#4A3F35" stroke-linejoin="round" stroke-width="3">
      <slot></slot>
    </g>
  </svg>
</template>
```

- [ ] **Step 4: 实现 9 个图标**

按下面模板创建 9 个文件。以下逐个给出完整内容。

`spot-adventure.vue`（火箭·闯关冒险）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="88" fill="#8FC98A" opacity=".45" rx="30" ry="8" stroke="none" />
    <path d="M40 86 L35 52 Q36 24 50 12 Q64 24 65 52 L60 86Z" fill="#FFF9F0" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M50 12 Q61 23 62 46 L38 46 Q39 23 50 12Z" fill="#E8756B" stroke="#4A3F35" stroke-width="3" />
    <circle cx="50" cy="36" fill="#9DD9E8" r="7" stroke="#4A3F35" stroke-width="3" />
    <path d="M35 42 L24 62 L40 62Z" fill="#E8756B" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M65 42 L76 62 L60 62Z" fill="#E8756B" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M44 88 Q50 100 56 88 Q50 93 44 88Z" fill="#FFC96B" stroke="#4A3F35" stroke-width="2.4" />
  </svg>
</template>
```

`spot-cards.vue`（帐篷·看图识物）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="32" ry="8" stroke="none" />
    <path d="M20 84 L50 24 L80 84Z" fill="#FFF9F0" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M36 84 L50 54 L64 84Z" fill="#F0A868" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M20 84 L28 66 L36 84Z" fill="#E8756B" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M80 84 L72 66 L64 84Z" fill="#E8756B" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M50 24 L50 10 L62 15 L50 19" fill="#5B8DB8" stroke="#4A3F35" stroke-width="2.6" stroke-linejoin="round" />
  </svg>
</template>
```

`spot-letters.vue`（ABC 积木·英文乐园）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="30" ry="8" stroke="none" />
    <rect x="18" y="56" width="30" height="30" rx="5" fill="#FFE0B5" stroke="#4A3F35" stroke-width="3" />
    <rect x="52" y="56" width="30" height="30" rx="5" fill="#CFE3F0" stroke="#4A3F35" stroke-width="3" />
    <rect x="35" y="24" width="30" height="30" rx="5" fill="#F7C9CE" stroke="#4A3F35" stroke-width="3" />
    <text x="33" y="79" fill="#4A3F35" font-family="system-ui, sans-serif" font-size="18" font-weight="900" stroke="none" text-anchor="middle">A</text>
    <text x="67" y="79" fill="#4A3F35" font-family="system-ui, sans-serif" font-size="18" font-weight="900" stroke="none" text-anchor="middle">B</text>
    <text x="50" y="46" fill="#4A3F35" font-family="system-ui, sans-serif" font-size="18" font-weight="900" stroke="none" text-anchor="middle">C</text>
  </svg>
</template>
```

`spot-pinyin.vue`（汉字书屋·中文乐园）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="32" ry="8" stroke="none" />
    <rect x="22" y="42" width="56" height="42" rx="6" fill="#FFF9F0" stroke="#4A3F35" stroke-width="3" />
    <path d="M12 42 L50 14 L88 42Z" fill="#D96A5F" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <rect x="40" y="60" width="20" height="24" rx="4" fill="#E8A0B4" stroke="#4A3F35" stroke-width="3" />
    <rect x="62" y="46" width="22" height="18" rx="4" fill="#FFD98E" stroke="#4A3F35" stroke-width="3" />
    <text x="73" y="60" fill="#4A3F35" font-family="system-ui, sans-serif" font-size="13" font-weight="900" stroke="none" text-anchor="middle">中</text>
  </svg>
</template>
```

`spot-poems.vue`（卷轴树·古诗花园）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="88" fill="#8FC98A" opacity=".45" rx="30" ry="8" stroke="none" />
    <rect x="45" y="46" width="10" height="42" rx="5" fill="#B98A5E" stroke="#4A3F35" stroke-width="3" />
    <circle cx="30" cy="38" fill="#8FC98A" r="18" stroke="#4A3F35" stroke-width="3" />
    <circle cx="70" cy="35" fill="#A8D5A2" r="17" stroke="#4A3F35" stroke-width="3" />
    <circle cx="50" cy="20" fill="#9BD196" r="19" stroke="#4A3F35" stroke-width="3" />
    <rect x="14" y="44" width="22" height="27" rx="3" fill="#FFFDF7" stroke="#4A3F35" stroke-width="3" />
    <path d="M20 52 h10 M20 58 h10 M20 64 h7" stroke="#C9B7A0" stroke-linecap="round" stroke-width="2.6" />
  </svg>
</template>
```

`spot-logic.vue`（齿轮工坊·逻辑挑战）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="30" ry="8" stroke="none" />
    <rect x="22" y="48" width="56" height="38" rx="7" fill="#FFF9F0" stroke="#4A3F35" stroke-width="3" />
    <path d="M16 48 L50 20 L84 48Z" fill="#8FC98A" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <circle cx="50" cy="68" fill="#FFD98E" r="13" stroke="#4A3F35" stroke-width="3" />
    <circle cx="50" cy="68" fill="#FFF9F0" r="4.5" stroke="#4A3F35" stroke-width="2.6" />
    <g stroke="#4A3F35" stroke-linecap="round" stroke-width="3">
      <path d="M50 52 v-6 M50 84 v6 M34 68 h-6 M66 68 h6 M39 57 l-4 -4 M61 57 l4 -4 M39 79 l-4 4 M61 79 l4 4" />
    </g>
  </svg>
</template>
```

`spot-numbers.vue`（城堡·数字王国）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="32" ry="8" stroke="none" />
    <rect x="14" y="50" width="18" height="36" rx="3" fill="#D5CFEA" stroke="#4A3F35" stroke-width="3" />
    <rect x="68" y="50" width="18" height="36" rx="3" fill="#D5CFEA" stroke="#4A3F35" stroke-width="3" />
    <rect x="34" y="30" width="32" height="56" rx="4" fill="#CFE3F0" stroke="#4A3F35" stroke-width="3" />
    <path d="M14 50 L23 30 L32 50Z" fill="#5B8DB8" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <path d="M68 50 L77 30 L86 50Z" fill="#5B8DB8" stroke="#4A3F35" stroke-width="3" stroke-linejoin="round" />
    <rect x="44" y="64" width="12" height="22" rx="3" fill="#E8756B" stroke="#4A3F35" stroke-width="3" />
    <text x="50" y="50" fill="#4A3F35" font-family="system-ui, sans-serif" font-size="13" font-weight="900" stroke="none" text-anchor="middle">123</text>
  </svg>
</template>
```

`spot-songs.vue`（音乐舞台·儿歌点播）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="32" ry="8" stroke="none" />
    <rect x="16" y="60" width="68" height="26" rx="8" fill="#E8A0B4" stroke="#4A3F35" stroke-width="3" />
    <rect x="23" y="66" width="54" height="15" rx="5" fill="#FFF9F0" stroke="#4A3F35" stroke-width="2.6" />
    <path d="M44 62 V32 M44 32 l22 -5 v21" fill="none" stroke="#4A3F35" stroke-linecap="round" stroke-width="3" />
    <circle cx="39" cy="62" fill="#5B8DB8" r="6" stroke="#4A3F35" stroke-width="2.6" />
    <circle cx="61" cy="57" fill="#5B8DB8" r="6" stroke="#4A3F35" stroke-width="2.6" />
  </svg>
</template>
```

`spot-rewards.vue`（宝箱·我的星星）：

```vue
<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="86" fill="#8FC98A" opacity=".45" rx="30" ry="8" stroke="none" />
    <path d="M20 50 Q20 26 50 26 Q80 26 80 50Z" fill="#E8A0B4" stroke="#4A3F35" stroke-width="3" />
    <rect x="20" y="50" width="60" height="32" rx="7" fill="#F0BFCB" stroke="#4A3F35" stroke-width="3" />
    <rect x="43" y="46" width="14" height="19" rx="4" fill="#FFD98E" stroke="#4A3F35" stroke-width="3" />
    <circle cx="50" cy="55" fill="#4A3F35" r="3" stroke="none" />
    <g fill="#FFD98E" stroke="#4A3F35" stroke-width="2.4">
      <path d="M68 20 l4 8 9 1.5 -6.5 6.5 1.5 9 -8 -4.5 -8 4.5 1.5 -9 -6.5 -6.5 9 -1.5Z" />
      <path d="M26 16 l3 6 7 1 -5 5 1 7 -6 -3.5 -6 3.5 1 -7 -5 -5 7 -1Z" opacity=".92" />
    </g>
  </svg>
</template>
```

- [ ] **Step 5: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/icons/__tests__/icons.test.ts
```

预期：PASS，3 个用例全绿。

- [ ] **Step 6: 提交**

```bash
git add apps/web-antd/src/views/kid/components/icons
git commit -m "feat(@vben/web-antd): 新增 9 个模块自绘 SVG 图标，替换 emoji"
```

---

## Task 5: 岛上坐标表 island-spots

**Files:**
- Create: `apps/web-antd/src/data/island-spots.ts`
- Create: `apps/web-antd/src/data/__tests__/island-spots.test.ts`

**Interfaces:**
- Consumes: `TILE_KEYS`（`data/modules.ts`）
- Produces:
  - `ISLAND_VIEWBOX = { height: 660, width: 1000 }`
  - `IslandSpot` 类型：`{ key: TileKey; x: number; y: number; scale: number; row: 'back' | 'front' }`
  - `ISLAND_SPOTS: IslandSpot[]` —— 9 条，`y` 为地点「落地点」（图形底边）的纵坐标
  - `spotsFor(enabled: (key: TileKey) => boolean): IslandSpot[]`

**坐标来源**：设计稿 `docs/superpowers/specs/2026-09-26-kid-ui-modernization-mockup.html` 中已按岛的真实草地边界逐点校准（用 `getPointAtLength` 采样草地路径后定位），直接沿用，不要重新估算。

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/data/__tests__/island-spots.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

import { ISLAND_SPOTS, ISLAND_VIEWBOX, spotsFor } from '../island-spots';
import { TILE_KEYS } from '../modules';

/** 岛草地边界的实测采样（x → [草地顶, 草地底]），来自设计稿校准数据 */
const GRASS_TOP: Array<[number, number]> = [
  [205, 394], [300, 361], [350, 347], [400, 342], [500, 339],
  [600, 342], [650, 347], [700, 361], [785, 394],
];
const GRASS_BOTTOM: Array<[number, number]> = [
  [205, 568], [300, 572], [350, 613], [400, 618], [500, 621],
  [600, 618], [650, 613], [700, 572], [785, 568],
];

const interp = (table: Array<[number, number]>, x: number) => {
  const sorted = [...table].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const [x0, y0] = sorted[i]!;
    const [x1, y1] = sorted[i + 1]!;
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return undefined;
};

describe('islandSpots', () => {
  it('9 个入口各有一个地点，不多不少', () => {
    expect(ISLAND_SPOTS.map((s) => s.key).sort()).toEqual([...TILE_KEYS].sort());
  });

  it('坐标落在 viewBox 内', () => {
    for (const spot of ISLAND_SPOTS) {
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(ISLAND_VIEWBOX.width);
      expect(spot.y).toBeGreaterThan(0);
      expect(spot.y).toBeLessThan(ISLAND_VIEWBOX.height);
    }
  });

  it('每个地点都真的站在草地上', () => {
    for (const spot of ISLAND_SPOTS) {
      expect(interp(GRASS_TOP, spot.x)).toBeDefined();
      expect(spot.y).toBeGreaterThan(interp(GRASS_TOP, spot.x)!);
      expect(spot.y).toBeLessThan(interp(GRASS_BOTTOM, spot.x)!);
    }
  });

  it('后排在上、前排在下', () => {
    for (const spot of ISLAND_SPOTS) {
      if (spot.row === 'back') expect(spot.scale).toBeLessThan(0.8);
      else expect(spot.scale).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('同排相邻地点不重叠（横向间距大于两者宽度之和的一半）', () => {
    for (const row of ['back', 'front'] as const) {
      const list = ISLAND_SPOTS.filter((s) => s.row === row).sort((a, b) => a.x - b.x);
      for (let i = 0; i < list.length - 1; i++) {
        const gap = list[i + 1]!.x - list[i]!.x;
        expect(gap).toBeGreaterThan(45);
      }
    }
  });

  it('家长关掉的模块不出现在结果里', () => {
    const only = spotsFor((key) => key === 'letters');
    expect(only.map((s) => s.key)).toEqual(['letters']);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/island-spots.test.ts
```

预期：FAIL —— `Failed to resolve import "../island-spots"`。

- [ ] **Step 3: 实现坐标表**

创建 `apps/web-antd/src/data/island-spots.ts`：

```ts
import type { TileKey } from './modules';

import { TILE_KEYS } from './modules';

/** 岛场景的坐标系。所有坐标都在这个空间里，由 KidIsland 等比缩放。 */
export const ISLAND_VIEWBOX = { height: 660, width: 1000 } as const;

export interface IslandSpot {
  key: TileKey;
  /** 后排 'back' 更小更靠上（营造景深），前排 'front' 更大更靠下 */
  row: 'back' | 'front';
  scale: number;
  /** 地点「落地点」横坐标 */
  x: number;
  /** 地点「落地点」纵坐标（图形底边所在高度） */
  y: number;
}

/**
 * 9 个模块在岛上的位置。
 *
 * ⚠️ 这些数字不是估的：设计阶段用 getPointAtLength 采样了草地路径的
 * 真实边界，再按「后排落地 = 草地顶 + 92 / 前排落地 = 草地底 - 22」逐个定位。
 * 改动前请先跑 `island-spots.test.ts` —— 它会把地点钉在草地上。
 */
export const ISLAND_SPOTS: IslandSpot[] = [
  // 后排（远·小）
  { key: 'adventure', row: 'back', scale: 0.68, x: 300, y: 453 },
  { key: 'letters', row: 'back', scale: 0.68, x: 400, y: 434 },
  { key: 'pinyin', row: 'back', scale: 0.68, x: 500, y: 431 },
  { key: 'numbers', row: 'back', scale: 0.68, x: 600, y: 434 },
  { key: 'poems', row: 'back', scale: 0.68, x: 700, y: 453 },
  // 前排（近·大）
  { key: 'cards', row: 'front', scale: 0.95, x: 205, y: 546 },
  { key: 'logic', row: 'front', scale: 0.95, x: 350, y: 591 },
  { key: 'songs', row: 'front', scale: 0.95, x: 650, y: 591 },
  { key: 'rewards', row: 'front', scale: 0.95, x: 785, y: 552 },
];

/**
 * 按模块开关过滤。
 *
 * `rewards` 不是可学习模块（`isLearnModule('rewards') === false`），
 * 家长端没有它的开关，因此始终显示。
 */
export function spotsFor(enabled: (key: TileKey) => boolean): IslandSpot[] {
  return ISLAND_SPOTS.filter(
    (spot) => spot.key === 'rewards' || enabled(spot.key),
  );
}

/** 断言用：坐标表必须覆盖全部入口 */
export const ISLAND_SPOT_KEYS: readonly TileKey[] = TILE_KEYS;
```

- [ ] **Step 4: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/data/__tests__/island-spots.test.ts
```

预期：PASS，6 个用例全绿。若「同排相邻不重叠」失败，调 `x` 值使间距 > 45，**不要改测试**。

- [ ] **Step 5: 提交**

```bash
git add apps/web-antd/src/data/island-spots.ts apps/web-antd/src/data/__tests__/island-spots.test.ts
git commit -m "feat(@vben/web-antd): 新增学习岛地点坐标表与派生逻辑"
```

---

## Task 6: KidSpot 与 KidLabel

**Files:**
- Create: `apps/web-antd/src/views/kid/components/kid-label.vue`
- Create: `apps/web-antd/src/views/kid/components/kid-spot.vue`
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-spot.test.ts`

**Interfaces:**
- Consumes: `IslandSpot`（Task 5）、9 个图标组件（Task 4）、`KID_MODULE_COLOR`（Task 1）
- Produces:
  - `KidLabel` —— props `{ text: string }`
  - `KidSpot` —— props `{ label: string; spot: IslandSpot }`，emit `select: []`

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-spot.test.ts`：

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { IslandSpot } from '#/data/island-spots';

import KidSpot from '../kid-spot.vue';

const SPOT: IslandSpot = { key: 'letters', row: 'front', scale: 0.95, x: 350, y: 591 };

describe('kidSpot', () => {
  it('用 translate + scale 定位到坐标表给的位置', () => {
    const wrapper = mount(KidSpot, { props: { label: '英文乐园', spot: SPOT } });
    expect(wrapper.get('[data-spot]').attributes('transform')).toBe(
      'translate(350,591) scale(0.95)',
    );
  });

  it('点击派发 select', async () => {
    const wrapper = mount(KidSpot, { props: { label: '英文乐园', spot: SPOT } });
    await wrapper.get('[data-spot]').trigger('click');
    expect(wrapper.emitted('select')).toHaveLength(1);
  });

  it('名字牌默认不显示（3-5 岁不识字，常驻文字只是噪音）', () => {
    const wrapper = mount(KidSpot, { props: { label: '英文乐园', spot: SPOT } });
    expect(wrapper.get('[data-label]').classes()).toContain('opacity-0');
  });

  it('悬停时名字牌显示', () => {
    const wrapper = mount(KidSpot, { props: { label: '英文乐园', spot: SPOT } });
    expect(wrapper.get('[data-spot]').classes()).toContain('group');
    expect(wrapper.get('[data-label]').classes()).toContain('group-hover:opacity-100');
  });

  it('带 aria-label 供读屏与家长识别', () => {
    const wrapper = mount(KidSpot, { props: { label: '英文乐园', spot: SPOT } });
    expect(wrapper.get('[data-spot]').attributes('aria-label')).toBe('英文乐园');
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-spot.test.ts
```

预期：FAIL —— `Failed to resolve import "../kid-spot.vue"`。

- [ ] **Step 3: 实现 KidLabel**

创建 `apps/web-antd/src/views/kid/components/kid-label.vue`：

```vue
<script setup lang="ts">
/**
 * 地点名字牌。默认隐藏，悬停/聚焦时回弹弹出。
 *
 * 为什么不做常驻标签：3-5 岁还不识字，常驻文字对他们是纯噪音，
 * 只会把场景挤乱。名字靠 TTS 念出来，文字只服务陪同的家长。
 */
defineProps<{ text: string }>();
</script>

<template>
  <g data-label class="pointer-events-none opacity-0 transition-opacity duration-[160ms]">
    <rect
      fill="#FFFDF7"
      height="26"
      rx="13"
      stroke="#4A3F35"
      stroke-width="2.8"
      width="84"
      x="-42"
      y="-16"
    />
    <text
      fill="#4A3F35"
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
```

- [ ] **Step 4: 实现 KidSpot**

创建 `apps/web-antd/src/views/kid/components/kid-spot.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue';

import type { IslandSpot } from '#/data/island-spots';
import type { TileKey } from '#/data/modules';

import KidIcon from './icons/kid-icon.vue';
import KidLabel from './kid-label.vue';
import SpotAdventure from './icons/spot-adventure.vue';
import SpotCards from './icons/spot-cards.vue';
import SpotLetters from './icons/spot-letters.vue';
import SpotLogic from './icons/spot-logic.vue';
import SpotNumbers from './icons/spot-numbers.vue';
import SpotPinyin from './icons/spot-pinyin.vue';
import SpotPoems from './icons/spot-poems.vue';
import SpotRewards from './icons/spot-rewards.vue';
import SpotSongs from './icons/spot-songs.vue';

const props = defineProps<{ label: string; spot: IslandSpot }>();
const emit = defineEmits<{ select: [] }>();

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

/** 名字牌的位置：抬到图标上方。前排图标更大，牌子也要抬得更高。 */
const labelOffset = computed(() =>
  props.spot.row === 'front' ? -134 : -98,
);

const transform = computed(
  () => `translate(${props.spot.x},${props.spot.y}) scale(${props.spot.scale})`,
);
</script>

<template>
  <!-- 分组名 group：名字牌靠 group-hover 显示，避免用 JS 管 hover 状态 -->
  <g
    class="group cursor-pointer"
    data-spot
    :aria-label="label"
    role="button"
    tabindex="0"
    :transform="transform"
    @click="emit('select')"
    @keydown.enter="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <!-- 内层负责悬停抬起：外层带 transform 属性，CSS 再写 transform 会把它覆盖掉 -->
    <g
      class="transition-transform duration-[220ms] group-hover:-translate-y-2"
    >
      <KidIcon :size="100">
        <component :is="icon" />
      </KidIcon>
    </g>
    <g :transform="`translate(0,${labelOffset})`">
      <KidLabel class="group-hover:opacity-100" :text="label" />
    </g>
  </g>
</template>

<style scoped>
/* 悬停时整组轻微放大，与抬起形成层次 */
.group:hover {
  filter: drop-shadow(0 6px 0 rgb(74 63 53 / 18%));
}
</style>
```

> **实现警戒（本改造踩过两次同款坑）**：SVG 元素上的 `transform` **属性**会被同元素上的 CSS `transform`（含动画）覆盖，导致图形跳到画布原点。规则：**任何要加 CSS 位移/缩放的 `<g>`，都不要再挂 `transform` 属性，改用外层 `<g>` 承担 `translate`。** 这里 `.group` 持 `transform` 属性、内层 `<g>` 做 hover 位移，就是按这条规则拆的。

- [ ] **Step 5: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-spot.test.ts
```

预期：PASS，5 个用例全绿。

- [ ] **Step 6: 提交**

```bash
git add apps/web-antd/src/views/kid/components/kid-spot.vue apps/web-antd/src/views/kid/components/kid-label.vue apps/web-antd/src/views/kid/components/__tests__/kid-spot.test.ts
git commit -m "feat(@vben/web-antd): 新增岛地点 KidSpot 与名字牌 KidLabel"
```

---

## Task 7: KidIsland 场景

**Files:**
- Create: `apps/web-antd/src/views/kid/components/kid-island.vue`
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-island.test.ts`

**Interfaces:**
- Consumes: `ISLAND_SPOTS` / `ISLAND_VIEWBOX` / `spotsFor`（Task 5）、`KidSpot`（Task 6）、`useKidStore`、`$t`
- Produces: `KidIsland` —— 无 props；内部读 `useKidStore().moduleEnabled` 决定渲染哪些地点；emit `select: [key: TileKey]`

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-island.test.ts`：

```ts
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KidIsland from '../kid-island.vue';

// TTS 会碰 window.speechSynthesis，happy-dom 下未必存在，测试里替换掉
vi.mock('#/utils/tts', () => ({ speak: vi.fn() }));

describe('kidIsland', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('默认渲染全部 9 个地点', () => {
    const wrapper = mount(KidIsland);
    expect(wrapper.findAll('[data-spot]')).toHaveLength(9);
  });

  it('点击地点派发 select 并带上模块 key', async () => {
    const wrapper = mount(KidIsland);
    await wrapper.findAll('[data-spot]')[0]!.trigger('click');
    expect(wrapper.emitted('select')?.[0]?.[0]).toBeTruthy();
  });

  it('渲染成一个可缩放的 svg，视口与坐标表一致', () => {
    const wrapper = mount(KidIsland);
    const svg = wrapper.get('svg');
    expect(svg.attributes('viewbox')).toBe('0 0 1000 660');
    expect(svg.classes()).toContain('w-full');
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-island.test.ts
```

预期：FAIL —— `Failed to resolve import "../kid-island.vue"`。

- [ ] **Step 3: 实现 KidIsland**

创建 `apps/web-antd/src/views/kid/components/kid-island.vue`。

场景图层顺序不可调换（后画的盖住先画的）：天空 → 太阳/云/鸟 → 远山 → 海 → 岛（含投影）→ 草丛/花/灌木 → 小路 → 地点 → 吉祥物位。

完整内容以设计稿 `docs/superpowers/specs/2026-09-26-kid-ui-modernization-mockup.html` 中 `viewBox="0 0 1000 660"` 的那个 `<svg>` 为**逐字蓝本** —— 包括所有 `<path>` 的 `d`、渐变定义、以及各装饰元素的坐标。直接复制该 SVG 的静态部分（去掉 `.pop` / `.bob` / `.lift` 等动效包裹层，动效在 Task 8 统一加），然后：

1. 在所有装饰元素之后、`</svg>` 之前，插入地点渲染：
```vue
    <KidSpot
      v-for="spot in spots"
      :key="spot.key"
      :label="$t(`kid.modules.${spot.key}`)"
      :spot="spot"
      @select="pick(spot.key)"
    />
```
2. `<svg>` 根节点加 `class="w-full"` 与 `viewBox="0 0 1000 660"`，去掉固定 `width` / `height`
3. 给 `<svg>` 加 `role="img"` 与 `:aria-label="$t('kid.app.name')"`

`<script setup>` 部分：

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import type { TileKey } from '#/data/modules';

import { spotsFor } from '#/data/island-spots';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import KidSpot from './kid-spot.vue';

const emit = defineEmits<{ select: [key: TileKey] }>();

const router = useRouter();
const kidStore = useKidStore();

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

function pick(key: TileKey) {
  // 先出声再跳转：3-5 岁靠语音确认「我点到了什么」，视觉跳转太快来不及看
  speak($t(`kid.modules.${key}`));
  emit('select', key);
  router.push({ name: ROUTE_NAME[key] });
}
</script>
```

- [ ] **Step 4: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-island.test.ts
```

预期：PASS，3 个用例全绿。

- [ ] **Step 5: 提交**

```bash
git add apps/web-antd/src/views/kid/components/kid-island.vue apps/web-antd/src/views/kid/components/__tests__/kid-island.test.ts
git commit -m "feat(@vben/web-antd): 新增学习岛场景组件 KidIsland"
```

---

## Task 8: 岛的场景动效

**Files:**
- Modify: `apps/web-antd/src/views/kid/components/kid-island.vue`（加动效包裹层与样式）
- Modify: `apps/web-antd/src/views/kid/components/kid-spot.vue`（加入场弹出）
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-island-motion.test.ts`

**Interfaces:**
- Consumes: Task 7 的 `KidIsland`
- Produces: 无新 API，纯表现层

- [ ] **Step 1: 写失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-island-motion.test.ts`：

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../kid-island.vue', import.meta.url)),
  'utf8',
);

describe('学习岛动效约束', () => {
  it('必须支持 prefers-reduced-motion', () => {
    expect(source).toContain('prefers-reduced-motion');
  });

  it('循环动画周期不得全部相同（避免整屏一起动）', () => {
    const durations = [...source.matchAll(/animation-duration:\s*(\d+)s/g)].map(
      (m) => Number(m[1]),
    );
    expect(new Set(durations).size).toBeGreaterThan(3);
  });

  it('不出现会触发重排的属性动画', () => {
    for (const prop of ['width', 'height', 'top', 'left', 'margin', 'padding']) {
      expect(source).not.toMatch(new RegExp(`transition:\\s*${prop}\\b`));
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-island-motion.test.ts
```

预期：FAIL —— 尚未加入 `prefers-reduced-motion` 媒体查询。

- [ ] **Step 3: 加动效**

在 `kid-island.vue` 的 `<style scoped>` 中加入（关键帧名与设计稿一致）：

```css
/* ===== 环境层：常驻、极慢、周期全部错开 ===== */

.cloud { animation: drift 78s ease-in-out infinite alternate; }
.cloud.c2 { animation-duration: 96s; animation-delay: -22s; }
.cloud.c3 { animation-duration: 64s; animation-delay: -40s; }
@keyframes drift {
  from { transform: translateX(-30px); }
  to { transform: translateX(34px); }
}

.sun-halo { animation: halo 5.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes halo {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.11); opacity: 1; }
}

.rays { animation: spin 60s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes spin { to { transform: rotate(360deg); } }

.bird { animation: fly 34s linear infinite; }
.bird.b2 { animation-duration: 44s; animation-delay: -16s; }
@keyframes fly {
  from { transform: translate(-140px, 10px); }
  to { transform: translate(1140px, -56px); }
}
.wing { animation: flap 0.62s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
@keyframes flap {
  from { transform: scaleY(1); }
  to { transform: scaleY(0.35); }
}

.sea-shimmer { animation: shimmer 11s ease-in-out infinite alternate; }
@keyframes shimmer {
  from { transform: translateX(-16px); opacity: 0.28; }
  to { transform: translateX(16px); opacity: 0.55; }
}

.wave { animation: wavemove 9s ease-in-out infinite alternate; }
.wave.w2 { animation-duration: 12s; animation-delay: -3s; }
.wave.w3 { animation-duration: 7.5s; animation-delay: -6s; }
@keyframes wavemove {
  from { transform: translateX(-14px); }
  to { transform: translateX(18px); }
}

.grass { animation: sway 4.2s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: bottom center; }
.grass.g2 { animation-duration: 5.4s; animation-delay: -1.2s; }
.grass.g3 { animation-duration: 3.6s; animation-delay: -2.4s; }
@keyframes sway {
  from { transform: rotate(-4deg); }
  to { transform: rotate(4deg); }
}

.path-dash { animation: dash 7s linear infinite; }
@keyframes dash { to { stroke-dashoffset: -128; } }

/* ===== 无障碍：系统开了「减少动态效果」就全部停掉 ===== */
@media (prefers-reduced-motion: reduce) {
  .cloud, .sun-halo, .rays, .bird, .wing, .sea-shimmer,
  .wave, .grass, .flower, .bush, .path-dash, .pop, .bob {
    animation: none !important;
  }
}
```

对应的类名需要挂到 Task 7 从设计稿复制过来的那些 `<g>` / `<rect>` 上（云 `class="cloud"`、鸟 `class="bird"`、浪 `class="wave"`、草丛 `class="grass"` 等）。**注意**：任何挂了 `class` 的 `<g>` 都不要同时有 `transform` 属性 —— 见 Task 6 的实现警戒。

- [ ] **Step 4: 加地点入场与呼吸**

在 `kid-spot.vue` 中给外层 `<g>` 内再加一层：

```vue
    <!-- .pop 做入场（从地面弹出），.bob 做常驻呼吸；两者分层避免 transform 打架 -->
    <g class="pop" :style="{ '--d': `${(spot.x % 7) * 0.08}s` }">
      <g class="bob" :style="{ '--d': `${(spot.y % 11) * 0.15}s` }">
        <g class="transition-transform duration-[220ms] group-hover:-translate-y-2">
          <KidIcon :size="100"><component :is="icon" /></KidIcon>
        </g>
      </g>
    </g>
```

并在 `kid-island.vue` 的样式里补上 `.pop` / `.bob`（两者都定义在 island 的 scoped 样式里，靠 `:deep()` 穿透到 KidSpot 内部）：

```css
:deep(.pop) {
  animation: pop 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: var(--d, 0s);
  transform-box: fill-box;
  transform-origin: center bottom;
}
@keyframes pop {
  from { transform: scale(0.3) translateY(12px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

:deep(.bob) {
  animation: bob 3.8s ease-in-out infinite;
  animation-delay: var(--d, 0s);
}
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
```

- [ ] **Step 5: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-island-motion.test.ts
```

预期：PASS，3 个用例全绿。

- [ ] **Step 6: 浏览器手动确认**

```bash
pnpm dev:antd
```

打开 `http://localhost:5666/kid/home`，确认：云在飘、鸟在飞、草在摇、9 个地点各自呼吸且**步调不一致**、悬停有抬起与名字牌。然后在系统里开启「减少动态效果」（Windows：设置 → 辅助功能 → 视觉效果 → 动画效果），刷新，确认全部静止。

- [ ] **Step 7: 提交**

```bash
git add apps/web-antd/src/views/kid/components/kid-island.vue apps/web-antd/src/views/kid/components/kid-spot.vue apps/web-antd/src/views/kid/components/__tests__/kid-island-motion.test.ts
git commit -m "feat(@vben/web-antd): 学习岛环境动效与地点入场动画"
```

---

## Task 9: 首页换岛 + 布局导航重构 + 顶部 HUD

**Files:**
- Create: `apps/web-antd/src/views/kid/components/kid-hud.vue`
- Create: `apps/web-antd/src/views/kid/components/__tests__/kid-hud.test.ts`
- Modify: `apps/web-antd/src/views/kid/home/index.vue`
- Modify: `apps/web-antd/src/layouts/kid.vue`
- Delete: `apps/web-antd/src/layouts/components/kid/kid-side-menu.vue`

**Interfaces:**
- Consumes: `KidIsland`（Task 7）、`useCurrentChild`（已存在）、`useKidStore`（已存在）、`KidCornerActions`（已存在）
- Produces: `KidHud` —— props `{ showHome?: boolean }`（默认 `true`），emit `open-gate: []`

> **为什么首页、布局、HUD 必须同一个任务交付**：本任务删掉了常驻侧边栏。若把 HUD（返回入口）拆到下一个任务，中间态就是「9 个内容页全部无法回到首页」，应用虽然能编译但不可用。

- [ ] **Step 1: 写 KidHud 失败的测试**

创建 `apps/web-antd/src/views/kid/components/__tests__/kid-hud.test.ts`：

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import KidHud from '../kid-hud.vue';

describe('kidHud', () => {
  it('showHome=true 时渲染回岛按钮', () => {
    const wrapper = mount(KidHud, { props: { showHome: true } });
    expect(wrapper.find('[data-home]').exists()).toBe(true);
  });

  it('showHome=false（已在首页）时不渲染回岛按钮', () => {
    const wrapper = mount(KidHud, { props: { showHome: false } });
    expect(wrapper.find('[data-home]').exists()).toBe(false);
  });

  it('回岛按钮可点区域不小于 64px', () => {
    const wrapper = mount(KidHud, { props: { showHome: true } });
    expect(wrapper.get('[data-home]').classes()).toContain('min-h-16');
  });

  it('家长入口派发 open-gate', async () => {
    const wrapper = mount(KidHud, { props: { showHome: false } });
    await wrapper.get('[data-gate]').trigger('click');
    expect(wrapper.emitted('open-gate')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-hud.test.ts
```

预期：FAIL —— `Failed to resolve import "../kid-hud.vue"`。

- [ ] **Step 3: 实现 KidHud**

创建 `apps/web-antd/src/views/kid/components/kid-hud.vue`：

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';

import { $t } from '#/locales';

import { useCurrentChild } from '../hooks/use-current-child';

withDefaults(defineProps<{ showHome?: boolean }>(), { showHome: true });

const emit = defineEmits<{ 'open-gate': [] }>();

const router = useRouter();
const { childName } = useCurrentChild();

function goHome() {
  router.push({ name: 'KidHome' });
}
</script>

<template>
  <header class="flex shrink-0 items-center gap-3 px-5 pt-4">
    <!-- 可点区域 ≥ 64px：3-5 岁手指落点精度低，这是硬要求 -->
    <button
      v-if="showHome"
      class="flex min-h-16 min-w-16 items-center justify-center rounded-kid-pill border-kid-ink bg-kid-sun px-4 text-2xl shadow-kid-hard transition-transform duration-[120ms] active:translate-x-1 active:translate-y-1 active:shadow-none"
      data-home
      type="button"
      @click="goHome"
    >
      🏠
      <span class="sr-only">{{ $t('kid.home.backToIsland') }}</span>
    </button>

    <p class="truncate text-xl font-black text-kid-ink">
      {{ $t('kid.home.greeting', { name: childName }) }}
    </p>

    <button
      class="ml-auto flex min-h-16 items-center rounded-kid-pill border-kid-ink bg-kid-paper px-5 text-lg font-black text-kid-ink shadow-kid-hard transition-transform duration-[120ms] active:translate-x-1 active:translate-y-1 active:shadow-none"
      data-gate
      type="button"
      @click="emit('open-gate')"
    >
      🔒 {{ $t('kid.gate.entry') }}
    </button>
  </header>
</template>

<style scoped>
button {
  border-width: 3px;
}
</style>
```

> 若 `kid.home.backToIsland` 与 `kid.gate.entry` 在 `locales/langs/zh-CN/kid.json` 中不存在，一并补上对应中文与英文文案（`返回学习岛` / `家长`）。**不要复用「我是家长」那条** —— 语义不同。

- [ ] **Step 4: 运行确认通过**

```bash
pnpm test:unit apps/web-antd/src/views/kid/components/__tests__/kid-hud.test.ts
```

预期：PASS，4 个用例全绿。

- [ ] **Step 5: 首页换成岛**

用以下内容**整体覆盖** `apps/web-antd/src/views/kid/home/index.vue`：

```vue
<script setup lang="ts">
import { onMounted } from 'vue';

import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidIsland from '../components/kid-island.vue';
import { useCurrentChild } from '../hooks/use-current-child';

const { bound, childName } = useCurrentChild();

onMounted(() => {
  if (bound.value) {
    speak($t('kid.tts.welcome', { name: childName.value }));
  }
});
</script>

<template>
  <BindGuard v-if="!bound" />
  <!-- 岛本身就是首页的全部内容，不再需要标题与星星胶囊：星星数已移到顶部 HUD -->
  <KidIsland v-else />
</template>
```

- [ ] **Step 6: 布局改造**

用以下内容**整体覆盖** `apps/web-antd/src/layouts/kid.vue`：

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';

import KidHud from '#/views/kid/components/kid-hud.vue';

import RestOverlay from './components/kid/rest-overlay.vue';
import { useScreenGuard } from './composables/use-screen-guard';
import { useParentEntry } from './composables/use-parent-entry';

/**
 * 宝宝端布局：顶部 HUD（回岛 / 问候 / 家长入口）+ 全屏内容区。
 *
 * 改造前这里是「左侧常驻侧边栏 + 右侧内容」，是典型后台范式 ——
 * 侧边栏已移除，导航入口改由首页的学习岛承担，返回入口由 HUD 承担。
 */
const route = useRoute();
const router = useRouter();
const { finishRest, resting } = useScreenGuard();
const gateOpen = ref(false);

/** 首页不显示「回岛」按钮 */
const showHome = computed(() => route.name !== 'KidHome');

onMounted(() => {
  // 预热语音列表（部分浏览器需要先触发一次才能拿到 voices）
  window.speechSynthesis?.getVoices?.();
});

// 家长门禁：沿用原有实现，仅把触发源从角标换成 HUD
useParentEntry({ gateOpen, router });
</script>

<template>
  <div class="kid-layout flex h-full min-h-screen w-full flex-col overflow-hidden">
    <KidHud :show-home="showHome" @open-gate="gateOpen = true" />
    <div class="flex flex-1 flex-col overflow-y-auto">
      <RouterView />
    </div>
    <RestOverlay v-model:open="resting" @finish="finishRest" />
  </div>
</template>

<style scoped>
.kid-layout {
  background: linear-gradient(
    180deg,
    #fffbf2 0%,
    #ffeeda 26%,
    #ffe2ce 52%,
    #e4f0f8 72%,
    #c9e5f4 100%
  );
}
</style>
```

> **注意**：原 `kid.vue` 里的 `KidCornerActions` 与 `parent-gate-modal`、`learner-switch-modal` 承担了「回家 / 家长门禁 / 切换学习者」三个职责。上例把家长门禁接到了 HUD，但 `useParentEntry` 的现有签名需要先读一遍 `layouts/composables/use-parent-entry.ts` 再决定接线方式 —— 若它与 `KidCornerActions` 强耦合，本步骤改为：**保留 `KidCornerActions` 不动**，仅把它从右下角固定定位改为 HUD 内联，等第 2 部分再统一收编。实现者需在动手前读该文件确认，并在提交信息里说明实际接线方式。

- [ ] **Step 7: 删除侧边栏**

```bash
git rm apps/web-antd/src/layouts/components/kid/kid-side-menu.vue
```

- [ ] **Step 8: 类型检查 + 全量单测**

```bash
pnpm check:type && pnpm test:unit
```

预期：全部通过。

- [ ] **Step 9: 浏览器手动确认导航闭环**

```bash
pnpm dev:antd
```

逐条确认：
1. `/kid/home` 显示学习岛，无侧边栏，HUD 里**没有**回岛按钮
2. 点岛上任意地点 → 进入对应模块页，HUD 里**有**回岛按钮
3. 点回岛按钮 → 回到学习岛
4. 家长端（`/parent/*`）外观与改造前完全一致
5. 家长端关掉某个模块后，刷新学习岛，对应地点消失

- [ ] **Step 10: 提交**

```bash
git add apps/web-antd/src/views/kid/components/kid-hud.vue apps/web-antd/src/views/kid/components/__tests__/kid-hud.test.ts apps/web-antd/src/views/kid/home/index.vue apps/web-antd/src/layouts/kid.vue
git commit -m "feat(@vben/web-antd): 首页改为学习岛，移除侧边栏改由顶部 HUD 导航"
```

---

## Task 10: 字体接入（霞鹜文楷 + Baloo 2）

**Files:**
- Modify: `package.json`（`apps/web-antd/package.json`，dependencies）
- Modify: `apps/web-antd/src/bootstrap.ts`
- Modify: `apps/web-antd/src/layouts/kid.vue`（`font-family` 回退栈）

**Interfaces:**
- Consumes: 无
- Produces: 全局 `--kid-font-*` 变量与 `.kid-layout` 的字体族；`KidIsland` / `KidCard` 等无需改动即可生效

> **授权前提（不可绕过）**：只用 SIL OFL 1.1 字体。`lxgw-wenkai-screen-webfont` 与 `@fontsource/*` 均为 OFL。**不得引入阿里妈妈方圆体** —— 其许可明文禁止「拆分、修改」，而子集化正落在此条。

- [ ] **Step 1: 安装字体包**

```bash
pnpm -F @vben/web-antd add lxgw-wenkai-screen-webfont @fontsource/baloo-2
```

预期：`apps/web-antd/package.json` 的 `dependencies` 多出两条。

- [ ] **Step 2: 引入字体 CSS**

编辑 `apps/web-antd/src/bootstrap.ts`，在现有 `import '@vben/styles';` **之前**加入：

```ts
// 儿童端字体：霞鹜文楷（OFL，中文 UI 与汉字内容）+ Baloo 2（OFL，西文数字）。
// 两个包都按 unicode-range 分片，浏览器只下载页面实际用到的字块 ——
// 因此家长新增内容也不会出现缺字豆腐块。
import 'lxgw-wenkai-screen-webfont/style.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-900.css';
```

- [ ] **Step 3: 应用字体族**

在 `apps/web-antd/src/layouts/kid.vue` 的 `<style scoped>` 中，把 `.kid-layout` 的样式替换为：

```css
.kid-layout {
  background: linear-gradient(
    180deg,
    #fffbf2 0%,
    #ffeeda 26%,
    #ffe2ce 52%,
    #e4f0f8 72%,
    #c9e5f4 100%
  );

  /* 霞鹜文楷在前，系统圆体兜底；font-display: swap 由字体包自带的 @font-face 提供 */
  font-family:
    'LXGW WenKai Screen', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

- [ ] **Step 4: 验证字体真的生效**

```bash
pnpm dev:antd
```

打开 `/kid/home`，在 DevTools → Elements 里选中岛上的名字牌文字，确认 Computed 面板的 `font-family` 首项为 `LXGW WenKai Screen`；在 Network 面板筛选 `woff2`，确认只有少量分片被请求（**不是**一次拉全部）。

若首项被划掉（未加载成功），检查 `bootstrap.ts` 的 import 顺序 —— 字体 CSS 必须在 `@vben/styles` 之前，否则会被后者的 reset 覆盖 `font-family`。

- [ ] **Step 5: 提交**

```bash
git add apps/web-antd/package.json pnpm-lock.yaml apps/web-antd/src/bootstrap.ts apps/web-antd/src/layouts/kid.vue
git commit -m "feat(@vben/web-antd): 儿童端接入霞鹜文楷与 Baloo 2（均为 OFL）"
```

---

## 计划自审记录

**规格覆盖检查**（第 1 部分范围内）：

| 规格章节 | 对应任务 |
| --- | --- |
| §4.1 设计令牌（色彩 / 形状 / 动效） | Task 1 |
| §4.3 字体 | Task 10 |
| §5.1 `KidCard` / `KidButton` / `KidTabs` / `KidLabel` / `KidSpot` / `KidIsland` | Task 2 / 3 / 6 / 7 |
| §5.1 图标集 | Task 4 |
| §5.3 删除 `kid-side-menu`、`mode-tabs` | Task 9 / 3 |
| §5.4 新增 `island-spots.ts` | Task 5 |
| §6 导航与路由（去侧边栏 + 返回入口） | Task 9 |
| §4.2 动效三层（环境层 + 交互层落地） | Task 8 |
| §8 降级：`prefers-reduced-motion` | Task 8 |

**未覆盖、留待第 2 部分**（规格中已有、本计划不实现，避免误判为遗漏）：

- §4.2 奖励层动效（星星飞入、吉祥物庆祝）
- §5.1 `KidMascot`（吉祥物）
- §5.2 `kid-page` / `option-grid` / `bind-guard` / `progress-dots` / `star-toast` / `kid-corner-actions` / `rest-overlay` 重写
- §8 竖屏 / 窄容器降级为 3×3 网格
- §9 视觉回归（需要先为 `web-antd` 补 Playwright 配置）
- 9 个内容页套用新模板

**类型一致性检查**：`TileKey`（来自 `data/modules.ts`）在 Task 4/5/6/7 中用法一致；`IslandSpot` 字段名 `key/row/scale/x/y` 在 Task 5 定义、Task 6/7 使用，无改名。`KidColorName` 在 Task 1 定义、Task 3 使用，一致。

**一处已知偏差**：规格 §4.3 要求「子集范围由 `scripts/build-kid-font-subset.mjs` 从内容数据自动推导」。实测 `lxgw-wenkai-screen-webfont` / `@fontsource/*` 已自带 `unicode-range` 分片，运行时按需下载，比自建子集化脚本更稳（家长新增内容不会缺字），故 Task 10 改为直接用该机制，**不新建子集化脚本**。规格该条已过时，应同步修订。
