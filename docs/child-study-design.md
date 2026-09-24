# 幼儿学习网站（child-study）设计改造方案

> 版本：v1.0 ｜ 日期：2026-09-24 ｜ 基线：vue-vben-admin v5.7 monorepo

## 1. 现状分析

### 1.1 工程现状

| 维度 | 现状 |
|---|---|
| 架构 | pnpm + turbo monorepo，Vue 3.5 + Vite 8 + TypeScript，`type: module` |
| 应用 | `apps/` 下 5 个 Web 应用（web-antd / web-ele / web-naive / web-tdesign / web-antdv-next）+ `backend-mock`（Nitro mock 服务，含 JWT 登录/菜单/用户接口） |
| 内核包 | `packages/effects/request`（axios 封装 + 401 自动刷新）、`effects/access`（前端静态/后端动态双模式权限）、`effects/layouts`（基础布局）、`stores`（Pinia access/user/tabbar）、`@core/ui-kit`（shadcn 风格基础组件 + form-ui/popup-ui） |
| 路由 | 静态路由模块 `src/router/routes/modules/*.ts` + `import.meta.glob('../views/**/*.vue')` 页面自动映射，默认 `accessMode: frontend` |
| Mock | `.env.development` 中 `VITE_NITRO_MOCK=true`，Nitro 从 `apps/backend-mock/api/` 目录即文件即路由 |
| 业务代码 | 无任何幼儿/学习相关代码，纯模板，业务从零开发 |

### 1.2 结论

- 工程底座（构建、请求、认证、权限、布局、主题）成熟且可直接复用，**不需要重写**。
- 管理后台基因与「家长中心/内容管理」天然契合（表格、表单、上传组件齐全）。
- 宝宝端需要**彻底换皮肤**：vben 默认的密集后台布局不适用 3-6 岁用户，需要独立的儿童布局与主题。

## 2. 目标定位

面向 **3-6 岁学龄前儿童**的全功能学习平台：

- **宝宝端**：孩子直接操作，大图标、大按钮、全程语音引导（Web Speech API TTS），零文字门槛。
- **家长中心**：同一站点内以「家长门禁」隔离，查看学习报告、管理学习内容、设置每日计划。

第一期功能全景（全功能平台）：

1. **基础认知**：看图识物（动物/水果/交通工具/身体部位）、字母与拼音、数字与数数、颜色形状
2. **儿歌童谣**：分类列表 + 播放器（audio），可跟学
3. **学习激励**：答对得星星、连击奖励、每日任务清单、徽章成就墙
4. **学习记录**：每次学习自动埋点，形成进度与报告
5. **家长中心**：数据报告、内容管理（卡片/儿歌上传维护）、每日学习计划、时长控制（单次 20 分钟提醒）

## 3. 工程改造：瘦身与重组

### 3.1 删除多余应用

```
apps/web-ele、apps/web-naive、apps/web-tdesign、apps/web-antdv-next → 删除
playground/ → 保留至开发中期（组件用法参考库），上线前删除
docs/ → 保留（vben 文档站，不影响业务），后续可移除出 turbo 构建
```

同步清理：根 `package.json` 中 `dev:ele/naive/tdesign/antdv-next` 等脚本、turbo 缓存引用。

### 3.2 保留并改造的载体

| 保留 | 角色 | 改造要点 |
|---|---|---|
| `apps/web-antd` | 唯一前端应用，重命名建议 `@vben/web-child` | 双布局（宝宝端布局 + 家长端布局）、儿童主题、宝宝端路由 |
| `apps/backend-mock` | 第一期后端（Nitro） | 新增内容/记录/计划等 mock API；接口按真实后端形状设计，便于平滑替换 |
| `packages/*` 内核 | 原样复用 | 仅扩展儿童主题 CSS 变量与两套布局 |

### 3.3 最终目录结构（业务侧）

```
apps/web-antd/src/
├── views/
│   ├── kid/                        # 宝宝端（使用 KidLayout，无侧边栏）
│   │   ├── home/index.vue          # 学习岛首页（分类大图标入口）
│   │   ├── cards/                  # 看图识物：分类列表 + 卡片翻翻乐
│   │   ├── letters/                # 字母/拼音学习
│   │   ├── numbers/                # 数字与数数小游戏
│   │   ├── songs/                  # 儿歌列表 + 播放页
│   │   └── rewards/                # 我的星星与徽章
│   ├── parent/                     # 家长中心（BasicLayout 后台形态）
│   │   ├── dashboard/index.vue     # 学习报告（echarts：时长/正确率/星星曲线）
│   │   ├── content/                # 内容管理（卡片/儿歌，vxe-table CRUD）
│   │   ├── plan/index.vue          # 每日学习计划设置
│   │   └── settings/index.vue      # 时长控制、语音开关等
│   └── _core/                      # 保留：登录、404、403
├── router/routes/modules/
│   ├── kid.ts                      # 宝宝端路由（parent:false，免登录可玩，进度本地+云端）
│   └── parent.ts                   # 家长中心路由（需登录，meta.authority）
├── layouts/
│   ├── kid.vue                     # 儿童布局：全屏、无菜单、右下角"回家"按钮、家长门禁入口
│   └── (BasicLayout 保留给家长端)
├── api/                            # 按域拆分：content.ts / record.ts / plan.ts / song.ts
├── store/                          # kid.ts（星星/徽章/今日任务，pinia 持久化）
└── utils/tts.ts                    # 语音引导封装（speechSynthesis，可关）
```

## 4. 关键设计

### 4.1 双布局与家长门禁

- 宝宝端路由挂在独立顶层布局下，`preferences.app.accessMode` 保持 frontend 模式即可（家长端页面少，静态权限足够；后端菜单模式留作二期）。
- **家长门禁**：进入家长中心前弹「成人验证」——两位数乘法题或长按 3 秒（业界通行做法），防止宝宝误入。
- 登录态沿用现有 access store + JWT 流程（mock 后端已带 `/api/auth/login`、refreshToken），宝宝端不强制登录。

### 4.2 儿童交互与主题

| 原则 | 落地 |
|---|---|
| 大目标 | 点击目标 ≥ 80×80px，间距 ≥ 24px，卡片网格 ≤ 4 列 |
| 零文字 | 图标 + 语音 TTS 引导；每个页面进入即朗读标题与引导语 |
| 即时反馈 | 答对：星星动画 + 欢快音效（`@vueuse/motion` + CSS 动画）；答错：不惩罚，语音鼓励重试 |
| 防误触 | 全屏布局无系统返回，仅右下角固定「🏠 回家」大按钮 |
| 护眼 | 新增儿童主题（高饱和暖色系），通过 `@vben/preferences` 主题机制注入；护眼提醒每 20 分钟一次 |
| 状态管理 | 星星/徽章/今日任务放 pinia `persistedstate`（localStorage），云同步接口预留 |

### 4.3 内容数据模型（第一期 mock 形状，即未来表结构）

```
Category   { id, name, icon, type: card|letter|number|song, sortOrder }
Card       { id, categoryId, name, pinyin, image, audio?, words[] }
Song       { id, title, cover, url, duration, category }
LearnRecord{ id, childName, module, itemId, result: right|wrong, durationSec, createdAt }
RewardLog  { id, childName, stars, reason, createdAt }
DailyPlan  { date, items: [{ module, targetCount, done }], screenLimitMin }
Badge      { id, name, icon, condition }   // 前端规则引擎判定
```

### 4.4 API 设计（backend-mock 新增，Nitro 文件即路由）

```
GET  /api/content/categories        # 分类列表
GET  /api/content/cards?categoryId= # 卡片列表
GET  /api/content/songs             # 儿歌列表
POST /api/record/learn              # 上报学习记录（幂等：客户端生成 recordId）
GET  /api/record/report?range=week  # 报告聚合（时长、正确率、模块分布）
GET  /api/reward/mine               # 星星与徽章
POST /api/reward/exchange           # 星星消耗（兑换贴纸等，二期）
GET  /api/plan/today                # 今日任务
POST /api/plan                      # 家长设置计划
POST /api/upload                    # 内容上传（复用已有 upload mock，二期接真实存储）
```

mock 阶段数据存 Nitro 内存/JSON 文件；学习记录同时写 localStorage 兜底，保证断网可玩。

### 4.5 错误与加载

- 沿用 `effects/request` 统一拦截：4xx 映射文案、5xx 重试 ≤3 次。
- 宝宝端所有异步内容（卡片/儿歌）必须有骨架屏 + 兜底离线包（核心卡片内置打包），fetch 失败静默降级为本地资源，**儿童界面不出现错误弹窗**。

## 5. 技术决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 项目结构 | monorepo 保留，业务集中在 web-antd | 复用内核包与构建链，成本最低 |
| UI 基座 | web-antd（ant-design-vue 4） | 生态最全，家长端表格/表单直接用 |
| 权限 | frontend 静态模式 | 页面少且固定，后端菜单模式过度设计 |
| 后端 | 第一期 backend-mock（Nitro） | 零部署、接口形状即真实后端，后续可平滑切云服务/自建 |
| 语音 | Web Speech API（speechSynthesis） | 浏览器原生免费，中文音满足启蒙；不满足再换云 TTS |
| 图表 | echarts（工程已有插件封装） | 报告页零新增依赖 |
| 状态 | pinia + persistedstate | 工程自带，进度本地持久化天然支持 |

## 6. 实施计划

| 阶段 | 内容 | 产出/验收 |
|---|---|---|
| **P0 工程瘦身**（0.5 天） | 删 4 个多余应用与脚本；改标题/命名；儿童主题变量 | `pnpm dev:antd` 正常启动 |
| **P1 骨架搭建**（1 天） | KidLayout + 家长门禁；kid/parent 路由模块；tts 工具；mock API 骨架 | 学习岛空页面可导航，家长中心可登录进入 |
| **P2 核心学习**（3-4 天） | 看图识物（卡片+TTS+星星）、字母、数字三个模块 + 学习记录埋点 | 三模块完整可玩，星星累计正确 |
| **P3 儿歌与激励**（2 天） | 儿歌列表/播放器；每日任务；徽章成就墙 | 任务完成闭环 |
| **P4 家长中心**（2-3 天） | 学习报告（echarts）、内容管理 CRUD、每日计划、时长控制 | 报告数据与宝宝端记录一致 |
| **P5 打磨交付**（2 天） | 动效音效、护眼提醒、离线兜底、typecheck/lint/build 全过 | 冒烟测试清单通过 |

## 7. 风险与后续演进

1. **音频/图片素材版权**：第一期用免费可商用素材（如 openmoji、FreePDK 音效），上线前逐项核查版权。
2. **TTS 音质**：浏览器中文音色机械感强，二期可接入云 TTS（预生成 mp3 存对象存储）。
3. **多孩子/云同步**：现设计单机单娃；二期接 WorkBuddy 云服务（数据库+认证+存储）后，记录与星星云同步，支持多娃档案。
4. **移动端/PAD**：宝宝端布局按响应式开发，二期补 PWA（工程已有 vite-plugin-pwa 依赖）支持安装到平板桌面。
5. **内容安全**：家长上传内容走审核状态字段（draft/published），避免随意分发。

---

*本方案确认后，从 P0 工程瘦身开始实施。*
