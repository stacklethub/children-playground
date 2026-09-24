# locale

每个 app 使用的国际化可能不同，这里用于扩展国际化的功能，例如扩展 dayjs、antd 组件库的多语言切换，以及 app 本身的国际化文件。

## 目录结构

```
langs/
  zh-CN/
    kid.json      # 宝宝端文案（含 TTS 朗读文案），key 前缀 kid.*
    parent.json   # 家长中心文案，key 前缀 parent.*
  en-US/
    kid.json
    parent.json
```

## 关键约定：文件内容**不能**再包一层文件名

vben 的装配逻辑是「按文件名建前缀」（见 `packages/locales/src/i18n.ts` 的 `loadLocalesMapFromDir`）：

```ts
messages[fileName] = json.default; // fileName 即 kid / parent / page
```

所以 `zh-CN/kid.json` 的内容应当**直接**是：

```json
{ "app": { "name": "宝宝学堂" }, "modules": { "home": "学习岛" } }
```

用 `$t('kid.app.name')`、`$t('kid.modules.home')` 访问。

⚠️ **不要**在文件里再写一层 `{ "kid": { "app": ... } }`。
那会让实际路径变成 `kid.kid.app.name`，`$t('kid.app.name')` 解析失败并**原样显示 key**。
（`page.json` 的顶层是 `{ auth, dashboard }`，正是这个约定。）

## 新增文案的流程

1. 在 `zh-CN/` 与 `en-US/` 的对应文件里同时加 key，保持结构完全对称。
2. 组件/页面里通过 `$t('前缀.路径')` 引用；`<script setup>` 中需 `import { $t } from '#/locales'`。
3. TTS 朗读文案统一放 `kid.tts.*`，由 `utils/tts.ts` 读取，随界面语言切换朗读语音。
4. 跑一次校验：

```bash
pnpm -F @vben/web-antd run check:i18n
```

脚本会模拟 vben 的装配逻辑逐条解析源码中的 `$t()` 引用，检查中英两包是否全部命中、结构是否对称、英文包是否残留中文。

## 运行时切换语言

`@vben/locales` 的 `loadLocaleMessages` 只是 `i18n.global.locale.value = locale`，**不会刷新页面**。因此：

- 模板里 `{{ $t(...) }}`、`computed(() => $t(...))`、函数体内调用 `$t()` —— 都会随语言切换实时更新 ✅
- 在**模块顶层**求值并保存成字符串的场景（如路由 `meta.title: $t('...')` 在路由模块加载时求值）不会自动更新，语言切换后需重新加载页面才能刷新标题 ⚠️
