# 儿童端 UI 现代化改造 —— 设计规格

- **日期**：2026-09-26
- **分支**：`feat/child-study`
- **范围**：仅儿童端（`/kid/*`）。家长端不在本次范围。
- **设计稿**：`.superpowers/brainstorm/27299-1790415206/content/island-animated.html`（可视化伴随会话产物，含首页与内页两屏的动效版）

---

## 1. 背景与问题

儿童端已有 9 个模块、约 3200 行代码，功能完整。但视觉与交互停留在「后台管理系统」气质，用户反馈「老古董」。

现状体检：

| 问题 | 证据 |
| --- | --- |
| 像后台而非儿童 App | `kid-side-menu.vue` 是左侧常驻白底列表；首页 `/kid/home` 只有彩虹 + 一句问候 + 星星数，约 70% 屏幕是空的 |
| 配色浑浊 | `kid.vue` 背景 `from-sky-200 via-amber-50 to-rose-100`，中间段糊成灰米色 |
| 无设计系统 | 无任何 kid 专用 token；`rounded-3xl bg-white/95 shadow-xl` 在 8 个文件里各写一遍；「上一页」白圆钮在 4 个页面**逐字复制**，只有主题色不同 |
| 颜色无语义 | 模块主题色 sky/emerald/rose/lime/violet/cyan 各自为政，但「下一页」永远是 `orange-400` |
| 字体无性格 | `PingFang SC / Microsoft YaHei` + `font-black`，办公软件观感 |
| 图标全依赖 emoji | 跨平台渲染不一致（Windows 的 Segoe UI Emoji 与 Apple 差异显著），风格无法统一 |
| 动效稀疏 | 仅 `star-toast` 弹入与字母卡 3D 翻面，其余靠 `active:scale-95` |

**根本问题**：左侧常驻侧边栏 + 大面积留白的网格入口，是典型的 admin 布局范式。

---

## 2. 目标与非目标

### 目标

1. 儿童端 1 个首页 + 9 个内容页（8 个可学习模块 + 我的星星）视觉统一、现代化，符合 3–5 岁幼儿认知特点
2. 导航从「左侧常驻列表」改为「学习岛场景」，消除后台感
3. 建立 kid 设计系统：token → 组件 → 图标 → 动效规范，消除现有重复
4. 引入自托管 OFL 字体
5. 动效成体系，且不牺牲低端设备帧率

### 非目标

- 家长端任何改动
- 后端 / API / store 数据结构改动（本改造为纯 UI 层）
- 内容数据（词库、古诗、儿歌）改动
- 多语言新增（现有 `zh-CN` / `en-US` 保留）

---

## 3. 关键决策

| 决策项 | 结论 | 理由 | 被否决的方案 |
| --- | --- | --- | --- |
| 改造深度 | **重构导航 + 换新视觉** | 侧边栏是「像后台」的根因，只换皮解决不了 | 仅换配色皮肤；保留侧边栏做微调 |
| 目标年龄 | **3–5 岁（幼儿园）** | 能理解「首页 → 模块 → 内容」两层结构；主流启蒙 App 区间 | 2–3 岁（需单层导航）；5–7 岁（可承载更多文字） |
| 首页形态 | **可探索的场景（学习岛）** | 「3×3 等大网格 + 彩色圆底 + emoji」是最模板化的儿童 App 做法 | 网格换色三连（已做并被否决） |
| 视觉基调 | **绘本插画**：奶油纸底 + 暖棕描边 + 硬投影 | 耐看、久看不累、家长接受度高；描边在强光下仍清晰 | 糖果马卡龙（刺激但易腻）；新拟态（低对比，幼儿找不到按钮，属可用性问题） |
| 图标 | **全部自绘内联 SVG** | emoji 跨平台不一致；自绘可统一笔触与配色 | 继续用 emoji；引入第三方图标库 |
| 字体 | **霞鹜文楷（内容 + UI）+ Baloo 2 / Nunito（西文数字）** | 均为 SIL OFL 1.1，允许自由子集化；楷体与小学语文教材用字一致，教学上更正确 | **阿里妈妈方圆体**（免费商用但明文禁止「拆分、修改」，子集化正好踩线，不能用）；站酷快乐体（许可未明示可修改） |
| 模块页深度 | **统一模板 + 模块特色** | 内容页共用一套木牌卡模板，保留各自主题色与专属微动效 | 每模块独立场景插画（工作量 3–4 倍） |
| 动效策略 | **三层分级**：环境呼吸 / 交互反馈 / 奖励绽放 | 幼儿注意力易被无关运动吸走，满屏乱动等于没有重点 | 「所有元素一起动」 |

### 3.1 字体授权核查记录

- **阿里妈妈方圆体**：阿里巴巴官方声明「永久免费正版商用」，且允许嵌入 App / Web / 游戏。但使用限制明确包含「**不能进行二次创作**（不得新增、拆分、修改、仿制、反编译等）」。字体子集化属于「拆分 / 修改」，与该条款冲突，**本方案不采用**。
- **霞鹜文楷 LXGW WenKai**：SIL OFL 1.1。明确允许使用、研究、复制、合并、嵌入、修改、再分发。作者在 README 中给出特例：**为 Web Font 渲染优化而做的子集化 / 格式转换（WOFF/WOFF2），在不作为可安装桌面字体分发的前提下，可继续使用保留名称**。本方案完全落在此特例内。
- 保留名称约束：衍生字体不得使用「霞鹜」「落霞孤鹜」「LXGW」字样——本方案仅在子集化特例内使用，不构成衍生字体，无需改名。
- 西文圆体 **Baloo 2 / Nunito**：SIL OFL 1.1，可自由子集化。

---

## 4. 设计系统

### 4.1 令牌（Design Tokens）

新建 `apps/web-antd/src/design/kid/tokens.css`，在 `internal/tailwind-config/src/theme.css` 中通过 `@theme` 注册为 Tailwind 语义色，使类名可直接写 `bg-kid-paper` / `border-kid-ink`。

**作用域**：全部 token 挂在 `.kid-scope` 下（由 `layouts/kid.vue` 根元素承载），家长端继续使用 vben 现有 shadcn token，**互不影响**。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--kid-ink` | `#4A3F35` | 描边 / 正文（暖棕，非纯黑） |
| `--kid-ink-soft` | `#9A8877` | 次级文字 |
| `--kid-paper` | `#FFFDF7` | 卡片纸白 |
| `--kid-cream` | `#F5E3C6` | 沙地 |
| `--kid-coral` | `#E8756B` | 主强调 1 |
| `--kid-apricot` | `#F0A868` | 主强调 2 / 主 CTA |
| `--kid-sun` | `#FFD98E` | 高亮 / 星星 |
| `--kid-leaf` | `#8FC98A` | 自然 / 正确 |
| `--kid-leaf-dark` | `#7FB87C` | 草地描边 |
| `--kid-sky` | `#5B8DB8` | 信息 / 选中态 |
| `--kid-blush` | `#E8A0B4` | 柔和强调 |
| `--kid-lilac` | `#D5CFEA` | 柔和强调 2 |
| `--kid-sea` | `#6BBBD8` | 水体 |

形状与投影：

| Token | 值 |
| --- | --- |
| `--kid-radius-card` | `26px` |
| `--kid-radius-pill` | `999px` |
| `--kid-stroke` | `3px` |
| `--kid-shadow-hard` | `4px 4px 0 var(--kid-ink)` |
| `--kid-shadow-soft` | `0 10px 30px rgba(74,63,53,.14)` |

动效：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--kid-dur-fast` | `120ms` | 按压反馈 |
| `--kid-dur-base` | `220ms` | 悬停 / 状态切换 |
| `--kid-dur-enter` | `620ms` | 入场 |
| `--kid-ease-pop` | `cubic-bezier(.34,1.56,.64,1)` | 回弹（唯一的"性格"曲线） |
| `--kid-ease-soft` | `ease-in-out` | 环境动画 |

**模块主题色映射**（每个模块一个，供卡片、Tab、按钮取色）：

模块 key 以 `apps/web-antd/src/data/modules.ts` 的 `TILE_KEYS` 为唯一事实源（`MODULE_KEYS` 8 个可学习模块 + 非学习入口 `rewards`）：

| 模块 key | 中文名 | 主题 token |
| --- | --- | --- |
| `cards` | 看图识物 | `--kid-apricot` |
| `letters` | 英文乐园 | `--kid-sky` |
| `pinyin` | 中文乐园 | `--kid-coral` |
| `poems` | 古诗花园 | `--kid-leaf` |
| `logic` | 逻辑挑战 | `--kid-sun` |
| `adventure` | 闯关冒险 | `--kid-berry`（新增 `#B98A5E`） |
| `numbers` | 数字王国 | `--kid-lilac` |
| `songs` | 儿歌点播 | `--kid-blush` |
| `rewards` | 我的星星 | `--kid-gold`（新增 `#FFB100`） |

> 注：`rewards` 不属于 `MODULE_KEYS`（`isLearnModule('rewards') === false`），不参与家长端的模块开关。岛上它始终显示。

### 4.2 动效规范

**三层分级**——这是本方案的核心动效原则，实现时不得越层堆砌。

| 层 | 目的 | 时长 | 触发 | 手段 |
| --- | --- | --- | --- | --- |
| **环境层** | 场景「活着」，不抢注意力 | 3–96s，**各元素周期必须错开** | 常驻循环 | `transform` 位移/旋转、`opacity` |
| **交互层** | 告诉孩子「点到了」 | 120–220ms | hover / press | 位移 + 缩放，`--kid-ease-pop` |
| **奖励层** | 强化成就，稀有 | 400–900ms | 答对 / 通关 | 星星飞入 + 吉祥物庆祝 |

**硬性约束**：

1. 所有动画**只使用 `transform` 与 `opacity`**（走合成器，不触发重排/重绘）
2. 环境层**周期必须错开**（如云 64/78/96s），避免「整屏一起动」的机械感
3. **必须支持 `prefers-reduced-motion: reduce`**——命中时停止全部循环动画，仅保留状态切换的瞬时变化。这不是可选项：低端平板是主要使用场景
4. 同一屏内**常驻循环动画不超过 30 个节点**，超出需合并到父级 `transform`

**已实现清单**（见设计稿，作为验收基准）：

- 环境：云漂移 ×3 / 太阳光晕呼吸 + 光芒自转 / 飞鸟横穿 + 扇翅 ×2 / 海面高光游移 / 浪花摇摆 ×3 / 水面闪光点 ×3 / 全岛呼吸 / 草丛小花摇曳 ×8 / 灌木呼吸 ×2 / 9 个地点错峰浮动 / 小路虚线流动
- 细节：火箭尾焰抖动 / 齿轮旋转 / 音符升起 ×3 / 宝箱星星闪烁 ×2 / 帐篷旗帜摆动 / 树冠呼吸
- 角色：小熊呼吸 + 眨眼 + 抖耳 + 挥手
- 交互：悬停抬起 9px + 放大 1.07 + 名字牌回弹弹出；按下回缩 0.97；入场 9 点依次弹出（延迟 0.14–0.62s）
- 内页：字母浮动 / 徽章跳动 / 主 CTA 呼吸光晕 / 按钮悬停浮起 + 按下位移

### 4.3 字体

- **霞鹜文楷 LXGW WenKai**：UI 文案 + 汉字/古诗/拼音内容
- **Baloo 2**（或 Nunito）：英文字母、数字
- 落地方式：直接依赖官方 npm 包 `lxgw-wenkai-screen-webfont` 与 `@fontsource/baloo-2`
- **不做自建子集化脚本**：这两个包已自带 `unicode-range` 分片，浏览器只下载当前页面实际用到的字块。这比自建「从内容数据推导字符集」的子集化脚本更稳 —— 家长会新增内容，固定子集必然漏字出豆腐块
- 回退栈：`'LXGW WenKai Screen', 'PingFang SC', 'Microsoft YaHei', sans-serif`
- 引入位置：`apps/web-antd/src/bootstrap.ts`，且必须在 `import '@vben/styles'` **之前**，否则字体族会被样式包的 reset 覆盖

---

## 5. 组件清单

### 5.1 新增

| 组件 | 路径 | 职责 |
| --- | --- | --- |
| `KidCard` | `views/kid/components/kid-card.vue` | 木牌卡外壳：`--kid-radius-card` + `--kid-stroke` 描边 + `--kid-shadow-hard`。替换现有 8 处重复的 `rounded-[3rem] bg-white/95 shadow-2xl` |
| `KidButton` | `views/kid/components/kid-button.vue` | 厚底按钮，`variant: 'primary' \| 'ghost'`。替换 4 个页面逐字复制的「上一页 / 下一页」 |
| `KidTabs` | `views/kid/components/kid-tabs.vue` | 重写。合并现有 `kid-tabs.vue` 与 `mode-tabs.vue`（两者在做同一件事） |
| `KidLabel` | `views/kid/components/kid-label.vue` | 悬停/聚焦出现的名字牌 |
| `KidSpot` | `layouts/components/kid/kid-spot.vue` | 岛上的一个地点：图标 + 悬停浮动 + 名字牌 + 点击入口 |
| `KidIsland` | `layouts/components/kid/kid-island.vue` | 整块 SVG 场景，内部按坐标表渲染 9 个 `KidSpot` |
| `KidMascot` | `views/kid/components/kid-mascot.vue` | 小熊，`state: 'idle' \| 'wave' \| 'cheer' \| 'doze'` |
| 图标集 | `views/kid/components/icons/*.vue` | 9 个入口图标（8 模块 + 我的星星）+ 装饰元素（云 / 鸟 / 浪 / 花 / 灌木…），全部内联 SVG |

### 5.2 重写

| 文件 | 改动 |
| --- | --- |
| `layouts/kid.vue` | 去掉 `KidSideMenu`；加 `.kid-scope` 承载 token；顶部 HUD（头像 / 问候 / 星星）+ 返回 |
| `views/kid/components/kid-page.vue` | 改为场景化外壳，去掉 `h1` 大标题范式 |
| `views/kid/components/option-grid.vue` | 套用 `KidCard` + 主题色 |
| `views/kid/components/bind-guard.vue` | 套用新视觉 |
| `views/kid/components/progress-dots.vue` | 套用 token |
| `views/kid/components/star-toast.vue` | 保留 `star-pop`，接入奖励层规范 |
| `layouts/components/kid/kid-corner-actions.vue` | 改为顶部 HUD 的一部分（返回 + 家长入口） |
| `layouts/components/kid/rest-overlay.vue` | 套用新视觉 + 吉祥物 `doze` 态 |

### 5.3 删除

| 文件 | 原因 |
| --- | --- |
| `layouts/components/kid/kid-side-menu.vue` | 导航重构后不再需要 |
| `views/kid/components/mode-tabs.vue` | 合并进 `KidTabs` |

### 5.4 新增数据

`apps/web-antd/src/data/island-spots.ts`：模块 key → 岛上坐标（`x` / `y` / `scale` / `深度层` / 图标组件）的映射表。坐标与 `KidIsland` 分离，便于单独调参而不动组件。

---

## 6. 导航与路由

- 布局 `kid.vue`：去掉侧边栏，改为全屏场景 / 内容区
- **路由路径与 name 全部保持不变**（`/kid/letters`、`KidLetters` …），仅改变首页的入口形态：从「侧边栏列表」变为「岛上的地点」
- 首页 `/kid/home` = 学习岛
- **顶部 HUD 常驻**：头像 + 问候 + 星星数；非首页时左侧增加返回学习岛按钮
- 现有 `KidCornerActions` 的回家按钮职责并入顶部 HUD

> **风险**：去掉侧边栏后，模块页失去常驻导航。必须保证每个模块页都有明确的「回学习岛」入口，且该入口在 3–5 岁可点区域（≥ 64×64px）内。

---

## 7. 数据流

**本改造不修改 store、API、TTS 任何逻辑。**

- `useKidStore`：`moduleSettings` / 星星 / 进度 → 首页据此决定渲染哪些地点
- 家长关闭的模块：**岛上对应地点不渲染**（沿用现有派生规则：`!isLearnModule(def.key) || kidStore.moduleEnabled(def.key)`）
- `useContent()` / `useQuiz()` / `useReward()` / `useSongPlayer()` 等 hook 签名不变
- TTS：地点悬停/点击时 `speak(模块名)`，与现有 `kid-side-menu.vue` 的 `go()` 行为一致

---

## 8. 降级与边界处理

| 场景 | 处理 |
| --- | --- |
| **竖屏 / 窄容器** | 岛上场景横向过挤。当容器宽度 < 768px 时，`KidIsland` 降级为 3×3 卡片网格（复用 `KidSpot`，只是不再绝对定位）。这是硬性要求——平板横竖屏都会用到 |
| 未绑定学习者 | 保留现有 `BindGuard` 引导页，套用新视觉 |
| 字体加载失败 | 系统字体回退栈（`PingFang SC` → `Microsoft YaHei` → `sans-serif`） |
| 内容新增了生僻字 | 字体包按 `unicode-range` 分片，浏览器自动按需拉取含该字的分片，不会出现豆腐块 |
| 系统开启「减少动态效果」 | 关闭全部循环动画 |
| 低端设备帧率 | 环境动画节点数上限 30；超出时合并 transform 层级 |

---

## 9. 测试

现有：根目录 `vitest.config.ts`（happy-dom），`pnpm test:unit`，已有 11 个测试文件。

**新增单元测试**：

- `data/__tests__/island-spots.test.ts`
  - 9 个模块 key 全覆盖，无遗漏、无多余
  - 坐标在 `viewBox 0 0 1000 660` 内，且不互相重叠
  - 每个坐标落在岛的草地边界内（用草地图层的路径采样校验）
- `store/__tests__/module-settings.test.ts`（已有，扩展）
  - 家长关闭某模块 → 对应地点不出现在派生结果中
- `components/__tests__/kid-button.test.ts`、`kid-tabs.test.ts`
  - props / emit 契约

**视觉回归**：`web-antd` **当前未配置 Playwright**（仅 `playground/` 有）。需作为本改造的前置任务补上 `apps/web-antd/playwright.config.ts`，对首页 + 9 个模块页截图存档。若时间不允许，降级为「合并前人工截图比对」并在 PR 中附证据。

**无障碍**：
- 验证 `prefers-reduced-motion` 生效
- 比对比度：`--kid-ink #4A3F35` 在 `--kid-paper #FFFDF7` 上约 10.4:1，达标；`--kid-ink-soft #9A8877` 约 3.4:1，**仅限 ≥ 18px 字号使用**，正文禁用
- 岛上每个 `KidSpot` 提供可聚焦元素与 `aria-label`

**手动验收**：真机平板，横屏 + 竖屏各一遍。

---

## 10. 交付边界与风险

### 交付物

儿童端 10 个页面 + 布局 + 设计 token + 7 个共享组件 + 图标集 + 吉祥物 + 动效系统 + 字体

### 主要风险

| 风险 | 缓解 |
| --- | --- |
| 自绘 SVG 图标工作量大且质量不稳定 | 先交付 9 个模块图标 + 少量装饰，装饰元素可分批补 |
| 字体首屏请求数偏多 | 分片按需加载，首屏通常只命中少量分片；若 Network 面板显示请求数过多，改为在 `bootstrap.ts` 中只引 `style.css` 的常用分片子集 |
| 满屏动效在低端平板掉帧 | 环境动画节点上限 + `prefers-reduced-motion` + 上线前真机帧率实测 |
| 去侧边栏后模块页迷路 | 每个模块页强制有「回学习岛」入口；竖屏降级为网格 |
| 视觉回归测试未就绪 | 作为前置任务单独立项，不阻塞页面开发 |

### 待办（不属于本次实现）

- `.superpowers/` 加入 `.gitignore`
- `web-antd` 的 Playwright 配置
- 模块专属插画（本轮只做「模块特色」，不做独立场景）
