/**
 * i18n 完整性校验
 *
 * 关键点：vben 的语言包是「按文件名装配」的——
 *   packages/locales/src/i18n.ts → loadLocalesMapFromDir()
 *   messages[文件名] = 文件内容
 * 因此 `zh-CN/kid.json` 的内容必须直接是 `{ app: ..., modules: ... }`，
 * 由文件名提供 `kid.` 前缀；**不能在文件里再包一层 `{ "kid": {...} }`**，
 * 否则 $t('kid.app.name') 会解析失败并原样显示 key。
 *
 * 本脚本完全模拟该装配逻辑，逐条解析源码中的 $t(...) 引用：
 *   - 静态 key  → 精确解析
 *   - 动态 key（含 ${}）→ 转成正则与语言包所有叶子 key 做泛化匹配
 * 并检查两个语言包的 key 是否完全对称、英文包是否残留中文。
 *
 * 用法：pnpm -F @vben/web-antd run check:i18n
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = path.resolve(here, '../src');
const REPO_ROOT = path.resolve(here, '../../..');

const LANG_DIRS = [
  path.join(APP_SRC, 'locales/langs'),
  path.join(REPO_ROOT, 'packages/locales/src/langs'),
];

const LOCALES = ['zh-CN', 'en-US'];

/** 模拟 vben：messages[文件名] = json 内容 */
function buildMessages(locale) {
  const messages = {};
  for (const dir of LANG_DIRS) {
    const loc = path.join(dir, locale);
    if (!fs.existsSync(loc)) continue;
    for (const file of fs.readdirSync(loc)) {
      if (!file.endsWith('.json')) continue;
      messages[path.basename(file, '.json')] = JSON.parse(
        fs.readFileSync(path.join(loc, file), 'utf8'),
      );
    }
  }
  return messages;
}

/** 收集所有叶子 key（值为字符串的路径） */
function collectLeafKeys(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') collectLeafKeys(v, key, out);
    else out.push(key);
  }
  return out;
}

function resolveKey(messages, key) {
  let cur = messages;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

const escapeRe = (s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `kid.modules.${key}` → /^kid\.modules\.[^.]+$/ */
function patternToRegex(pattern) {
  const parts = pattern.split(/\$\{[^}]*\}/g);
  return new RegExp(`^${parts.map(escapeRe).join('[^.]+')}$`);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['langs', 'node_modules'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(vue|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ---- 扫描源码中的 $t() 引用 ----
const staticKeys = new Map();
const dynamicPatterns = new Map(); // pattern -> from

for (const file of walk(APP_SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\$t\(\s*(['"`])([^'"`]+)\1/g)) {
    const key = m[2];
    const from = path.relative(REPO_ROOT, file);
    if (key.includes('${')) {
      if (!dynamicPatterns.has(key)) dynamicPatterns.set(key, from);
    } else if (!staticKeys.has(key)) {
      staticKeys.set(key, from);
    }
  }
}

let problems = 0;

for (const locale of LOCALES) {
  const messages = buildMessages(locale);
  const allKeys = collectLeafKeys(messages);
  const missing = [];
  let dynamicHits = 0;

  for (const [key, from] of staticKeys) {
    if (typeof resolveKey(messages, key) !== 'string') {
      missing.push(`[静态] ${key}   ← ${from}`);
    }
  }

  for (const [pattern, from] of dynamicPatterns) {
    const re = patternToRegex(pattern);
    const hits = allKeys.filter((k) => re.test(k));
    if (hits.length === 0) {
      missing.push(`[动态] ${pattern}   ← ${from}（无任何匹配的 key）`);
    } else {
      dynamicHits += hits.length;
    }
  }

  console.log(`\n=== ${locale} ===`);
  console.log(
    `静态 key ${staticKeys.size} 个 · 动态模板 ${dynamicPatterns.size} 个（展开命中 ${dynamicHits} 个 key）`,
  );
  if (missing.length === 0) {
    console.log('✅ 全部命中');
  } else {
    problems += missing.length;
    console.log(`❌ 未命中 ${missing.length} 处（会原样显示 key）：`);
    for (const item of missing) console.log('   ' + item);
  }
}

// ---- 语言包对称性 & 英文包语言污染 ----
console.log('\n=== 语言包对称性 ===');
for (const name of ['kid', 'parent']) {
  const zh = buildMessages('zh-CN')[name];
  const en = buildMessages('en-US')[name];
  if (!zh || !en) {
    console.log(`${name}: ❌ 语言包缺失`);
    problems += 1;
    continue;
  }
  const zhKeys = collectLeafKeys(zh);
  const enKeys = collectLeafKeys(en);
  const onlyZh = zhKeys.filter((k) => !enKeys.includes(k));
  const onlyEn = enKeys.filter((k) => !zhKeys.includes(k));
  const chineseInEn = enKeys.filter((k) =>
    /[\u4e00-\u9fa5]/.test(String(resolveKey(en, k))),
  );
  console.log(
    `${name}: zh=${zhKeys.length} en=${enKeys.length}` +
      ` | 仅 zh=${onlyZh.length}${onlyZh.length ? ': ' + onlyZh.join(', ') : ''}` +
      ` | 仅 en=${onlyEn.length}${onlyEn.length ? ': ' + onlyEn.join(', ') : ''}` +
      ` | en 含中文=${chineseInEn.length}${chineseInEn.length ? ': ' + chineseInEn.join(', ') : ''}`,
  );
  problems += onlyZh.length + onlyEn.length + chineseInEn.length;
}

console.log(
  `\n结论: ${problems === 0 ? '✅ i18n 全部可用' : `❌ 共 ${problems} 处问题`}`,
);
process.exit(problems === 0 ? 0 : 1);
