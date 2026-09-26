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
{ "app": { "name": "幼儿学堂" }, "modules": { "home": "学习岛" } }
```

用 `$t('kid.app.name')`、`$t('kid.modules.home')` 访问。

⚠️ **不要**在文件里再写一层 `{ "kid": { "app": ... } }`。
那会让实际路径变成 `kid.kid.app.name`，`$t('kid.app.name')` 解析失败并**原样显示 key**。
（`page.json` 的顶层是 `{ auth, dashboard }`，正是这个约定。）

## 新增文案的流程

1. 在 `zh-CN/` 与 `en-US/` 的对应文件里同时加 key，保持结构完全对称。
2. 组件/页面里通过 `$t('前缀.路径')` 引用；`<script setup>` 中需 `import { $t } from '#/locales'`。
3. TTS 界面引导文案统一放 `kid.tts.*`，由 `utils/tts.ts` 读取，随界面语言切换朗读语音。注意：**学习内容**的朗读不在此列，见下节。
4. 跑一次校验：

```bash
pnpm -F @vben/web-antd run check:i18n
```

脚本会模拟 vben 的装配逻辑逐条解析源码中的 `$t()` 引用，检查中英两包是否全部命中、结构是否对称、英文包是否残留中文。

## i18n 的边界：内容层不参与国际化

i18n 只覆盖**界面框架文案**（按钮、提示、导航、题目问句、鼓励语）。

**学习内容保持中文单语，不随界面语言切换**——这是产品定位，不是遗漏：

| 属于内容层（不做 i18n） | 属于界面框架（做 i18n） |
| --- | --- |
| 卡片名称 / 拼音 / 小知识（`data/content.ts`） | 页面标题、按钮、提示（`kid.*`、`parent.*`） |
| 字母释义（`KidLetter.zh`） | 题目问句（`kid.tts.lettersQuiz` 等） |
| 数字汉字（`KidNumber.word`） | 鼓励语（`kid.tts.praise*` / `encourage*`） |
| 儿歌标题与歌词（取自接口） | 家长中心全部文案 |

因此：

- 内容数据结构不带英文字段，家长端「内容管理」也只编辑中文字段。
- 内容朗读**固定使用中文语音**，通过 `utils/tts.ts` 的 `CONTENT_TTS_LANG` 显式传入（若跟随界面语言，英文界面会用英文语音去念「大象」「三」这类中文内容）。涉及位置：看图识物卡片与分类名、字母释义、数字汉字、儿歌标题与歌词。
- 界面引导语不传 `lang`，跟随界面语言。

> 若将来要做英文版内容，应作为独立内容包（如 `content.en.ts` + 内容级 locale 字段）整体引入，而不是给现有字段加 `xxxEn` 后缀——后者会把双语渗透到表单、接口与校验里。

## 运行时切换语言

`@vben/locales` 的 `loadLocaleMessages` 只是 `i18n.global.locale.value = locale`，**不会刷新页面**。因此：

- 模板里 `{{ $t(...) }}`、`computed(() => $t(...))`、函数体内调用 `$t()` —— 都会随语言切换实时更新 ✅
- 在**模块顶层**求值并保存成字符串的场景（如路由 `meta.title: $t('...')` 在路由模块加载时求值）不会自动更新，语言切换后需重新加载页面才能刷新标题 ⚠️
