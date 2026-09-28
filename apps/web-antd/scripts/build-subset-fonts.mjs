#!/usr/bin/env node
/**
 * 字体子集化：把「霞鹜文楷 Screen」按项目实际用字裁剪，产出可直接内联的小体积字体。
 *
 * ## 为什么需要它
 *
 * 上游包 `lxgw-wenkai-screen-webfont` 按 unicode-range 切成 97 个分片（全量 4.87MB）。
 * 多文件构建下浏览器只下载用到的分片，没问题；但 `build:singlefile` 会把**所有**
 * 分片 base64 内联进 HTML（`assetsInlineLimit: Infinity`）→ 单文件里的字体占 6.5MB，
 * 是整个产物 60% 的体积。而其中绝大多数字形项目根本不会显示。
 *
 * 本脚本对每个分片做 harfbuzz 子集化（只保留交集字符），产物体积降到约 1/4。
 *
 * ## 保留哪些字
 *
 * 1. **项目用字**：扫描 `src/**` + `index.html` + vben 中文语言包。
 *    因此新增内容（内置题库 / 资料库表格）重新构建时会自动纳入 —— 只要先跑
 *    `fetch:content` 把表格落到 `library-content.json`，它就在扫描范围内。
 * 2. **常用字保底**：GB2312 一级汉字 3755 个（`scripts/data/cjk-common-3755.txt`）。
 *    覆盖家长输入的孩子姓名等运行时动态内容。
 *
 * 保底之外的生僻字不会显示成豆腐块 —— `layouts/kid.vue` 的 font-family 栈里
 * 有系统中文字体兜底，缺字只会回退到系统字体（风格略变，仍可读）。
 *
 * ## 用法
 *
 *   node scripts/build-subset-fonts.mjs            # 生成（内容未变则跳过）
 *   node scripts/build-subset-fonts.mjs --force    # 强制重新生成
 *   node scripts/build-subset-fonts.mjs --check    # 只校验产物存在（构建前用）
 *
 * 产物 `src/assets/fonts/**` **进版本控制**：让没有网络 / 没装 subset-font 的环境
 * 也能直接构建，同时给子集化失败留一个可用兜底。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/**
 * 惰性加载 subset-font。
 *
 * 它是 devDependency；产物 `src/assets/fonts/**` 已进版本控制，因此
 * 「没装这个包」不该让构建失败 —— 已有产物就直接沿用。
 */
let subsetFontModule;
let subsetFontLoadError;
function loadSubsetFont() {
  if (subsetFontModule !== undefined) return subsetFontModule;
  try {
    subsetFontModule = require('subset-font');
  } catch (error) {
    subsetFontModule = null;
    subsetFontLoadError = error;
  }
  return subsetFontModule;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..');
const MONOREPO_ROOT = path.resolve(APP_ROOT, '../..');

/** 上游字体包目录（分片 woff2 + 分片 CSS） */
const FONT_PKG_DIR = path.join(
  APP_ROOT,
  'node_modules/lxgw-wenkai-screen-webfont',
);
const SOURCE_CSS = path.join(FONT_PKG_DIR, 'lxgwwenkaiscreen.css');
/** 保底常用字表 */
const COMMON_CJK_FILE = path.join(HERE, 'data/cjk-common-3755.txt');
/** 生成产物目录 */
const OUT_DIR = path.join(APP_ROOT, 'src/assets/fonts');
const OUT_CSS = path.join(OUT_DIR, 'lxgw-subset.css');
const OUT_MANIFEST = path.join(OUT_DIR, 'manifest.json');

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const FORCE = args.has('--force');

/** 扫描的文本扩展名 */
const TEXT_EXT = /\.(?:css|html|json|less|md|scss|ts|vue)$/;

/** 扫描时跳过的目录 */
const SKIP_DIR =
  /(?:^|[\\/])(?:dist|node_modules|\.git|assets[\\/]fonts)(?:[\\/]|$)/;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

/** 递归收集目录下所有文件（跳过构建产物与依赖） */
function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (SKIP_DIR.test(full)) continue;
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * 收集需要保留的字符集。
 *
 * 除项目源码外，额外纳入 vben 中文语言包 —— 框架自带的界面文案（如登录页、
 * 错误提示）不在 `src/` 里，但它们同样会渲染。
 */
function collectCharset() {
  const charset = new Set();

  const scanRoots = [
    path.join(APP_ROOT, 'src'),
    path.join(MONOREPO_ROOT, 'packages/locales/src/langs/zh-CN'),
  ];
  const files = [path.join(APP_ROOT, 'index.html')];
  for (const root of scanRoots) files.push(...walk(root));

  for (const file of files) {
    if (!TEXT_EXT.test(file)) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const ch of text) {
      // 只保留「非 ASCII」字符：ASCII 由 Baloo 2 / 系统字体覆盖，无需进中文字体
      if (ch.codePointAt(0) > 127) charset.add(ch);
    }
  }

  // 保底常用字
  const common = fs.readFileSync(COMMON_CJK_FILE, 'utf8');
  for (const ch of common) charset.add(ch);

  return charset;
}

/** 解析 CSS 里的 @font-face 块，取出 src 文件名与 unicode-range */
function parseFaces(css) {
  const faces = [];
  for (const match of css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
    const block = match[1];
    const src = /url\('\.\/files\/([^']+)'\)/.exec(block);
    const range = /unicode-range:\s*([^;}\n]+)/.exec(block);
    if (!src || !range) continue;
    faces.push({ block, file: src[1], range: range[1].trim() });
  }
  return faces;
}

/** 把 unicode-range 字符串展开成码点集合 */
function parseRange(spec) {
  const codes = new Set();
  for (const part of spec.split(',')) {
    const token = part.trim().replace(/^U\+/i, '');
    if (token.includes('?')) {
      const base = Number.parseInt(token.replaceAll('?', '0'), 16);
      const span = 16 ** (token.match(/\?/g) || []).length;
      for (let i = 0; i < span; i++) codes.add(base + i);
      continue;
    }
    if (token.includes('-')) {
      const [start, end] = token.split('-').map((v) => Number.parseInt(v, 16));
      for (let i = start; i <= end; i++) codes.add(i);
    } else {
      codes.add(Number.parseInt(token, 16));
    }
  }
  return codes;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * 按 UTF-16 码元顺序比较字符，与 `Array.prototype.sort()` 的默认行为一致。
 *
 * oxlint 的 `require-array-sort-compare` 不允许无参排序（`[...charset]` 由 Set
 * 展开而来，工具推断不出是字符串数组）。显式传入等价比较器后**排序结果不变**，
 * 字符集哈希也就不会变——否则会被误判成「内容变化」而重建全部字体子集。
 */
function compareCharsetChars(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * 把码点集合压成紧凑的 unicode-range 写法（如 `U+4E00-4E05, U+5000`）。
 *
 * 子集化后必须**收窄** @font-face 的 unicode-range：保留原范围会让浏览器以为
 * 该分片覆盖了它并不含有的字形（如 emoji —— 霞鹜文楷本就没有 emoji 字形，
 * 一直靠系统 emoji 字体渲染），虽然规范要求浏览器查不到字形时继续回退，
 * 但收窄后语义准确、字体匹配也更快。
 */
function codesToRange(codes) {
  const sorted = [...new Set(codes)].toSorted((a, b) => a - b);
  const parts = [];
  let start = sorted[0];
  let end = sorted[0];
  for (const code of sorted.slice(1)) {
    if (code === end + 1) {
      end = code;
      continue;
    }
    parts.push(
      start === end
        ? `U+${start.toString(16)}`
        : `U+${start.toString(16)}-${end.toString(16)}`,
    );
    start = code;
    end = code;
  }
  parts.push(
    start === end
      ? `U+${start.toString(16)}`
      : `U+${start.toString(16)}-${end.toString(16)}`,
  );
  return parts.join(', ');
}

/** 产物格式版本；改动产物结构时递增，触发重新生成 */
const FORMAT_VERSION = 2;

/** 读取已有 manifest */
function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(OUT_MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

/** 校验产物是否可用（--check） */
function runCheck() {
  const manifest = readManifest();
  if (!manifest) fail('字体子集产物缺失，请先运行 `pnpm run subset:font`');
  if (!fs.existsSync(OUT_CSS)) fail(`缺少 ${path.relative(APP_ROOT, OUT_CSS)}`);
  const missing = manifest.faces.filter(
    (file) => !fs.existsSync(path.join(OUT_DIR, file)),
  );
  if (missing.length > 0) {
    fail(
      `字体产物不完整（缺 ${missing.length} 个分片），请重新运行 subset:font`,
    );
  }
  log(
    `✔ 字体子集产物就绪：${manifest.faces.length} 个分片，${(manifest.bytes / 1024).toFixed(0)}KB`,
  );
}

/** 分批并发执行，避免一次性塞满内存 */
async function inBatches(items, size, handler) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((item) => handler(item)));
  }
}

async function main() {
  if (CHECK_ONLY) {
    runCheck();
    return;
  }

  if (!fs.existsSync(SOURCE_CSS)) {
    fail(
      `找不到字体包 CSS：${SOURCE_CSS}\n  请先执行 pnpm install 安装 lxgw-wenkai-screen-webfont`,
    );
  }

  const charset = collectCharset();
  const charsetHash = sha256(
    `${FORMAT_VERSION}|${[...charset].toSorted(compareCharsetChars).join('')}`,
  );
  const sourceCss = fs.readFileSync(SOURCE_CSS, 'utf8');
  const sourceHash = sha256(sourceCss);
  const faces = parseFaces(sourceCss);

  log(
    `目标字符集 ${charset.size} 个（项目用字 + GB2312 一级常用字），字体分片 ${faces.length} 个`,
  );

  const manifest = readManifest();
  if (
    !FORCE &&
    manifest &&
    manifest.charsetHash === charsetHash &&
    manifest.sourceHash === sourceHash
  ) {
    log('内容未变化，跳过子集化（如需强制重建加 --force）');
    runCheck();
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 内容变了但工具不可用：沿用已入库的旧产物（略旧，但构建不中断）
  if (!loadSubsetFont()) {
    if (manifest) {
      console.warn('⚠ 未安装 subset-font，沿用已有的字体子集产物');
      runCheck();
      return;
    }
    fail(
      `未安装 subset-font（${subsetFontLoadError?.message ?? '未知原因'}）\n  请执行 pnpm install 后重试`,
    );
  }

  // 清掉上一次的分片，避免字符集缩小后残留旧文件被一起打包
  if (manifest?.faces) {
    for (const file of manifest.faces) {
      fs.rmSync(path.join(OUT_DIR, file), { force: true });
    }
  }

  const kept = [];
  let sourceBytes = 0;
  let subsetBytes = 0;
  let droppedChars = 0;

  const targets = faces
    .map((face) => {
      const range = parseRange(face.range);
      let text = '';
      const codes = [];
      for (const ch of charset) {
        const code = ch.codePointAt(0);
        if (range.has(code)) {
          text += ch;
          codes.push(code);
        }
      }
      return { ...face, codes, text };
    })
    .filter((face) => face.text.length > 0);

  const skipped = faces.length - targets.length;

  await inBatches(targets, 8, async (face) => {
    const input = path.join(FONT_PKG_DIR, 'files', face.file);
    let buffer;
    try {
      buffer = fs.readFileSync(input);
    } catch {
      droppedChars += face.text.length;
      return;
    }

    let output;
    try {
      output = await loadSubsetFont()(buffer, face.text, {
        targetFormat: 'woff2',
      });
    } catch (error) {
      // 单个分片失败不该中断整个构建：退回该分片原文件（略大，但不掉字）
      console.warn(
        `⚠ ${face.file} 子集化失败（${error.message}），保留原始分片`,
      );
      fs.writeFileSync(path.join(OUT_DIR, face.file), buffer);
      kept.push({ block: face.block, codes: face.codes, file: face.file });
      sourceBytes += buffer.length;
      subsetBytes += buffer.length;
      return;
    }

    fs.writeFileSync(path.join(OUT_DIR, face.file), output);
    kept.push({ block: face.block, codes: face.codes, file: face.file });
    sourceBytes += buffer.length;
    subsetBytes += output.length;
  });

  // 生成 CSS：只保留命中的 @font-face，src 指向同目录产物
  const families = new Set();
  for (const face of kept) {
    const name = /font-family:\s*'([^']+)'/.exec(face.block);
    if (name) families.add(name[1]);
  }

  const cssParts = [
    '/* 由 scripts/build-subset-fonts.mjs 生成，请勿手改。',
    ` * 源：lxgw-wenkai-screen-webfont（SIL OFL 1.1）`,
    ` * 子集化时间：${new Date().toISOString()}`,
    ` * 分片：${kept.length} / ${faces.length}，体积 ${(subsetBytes / 1024).toFixed(0)}KB`,
    ' * 重新生成：pnpm run subset:font',
    ' */',
  ];
  for (const face of kept) {
    const block = face.block
      .replace(/url\('\.\/files\/([^']+)'\)/, (_m, file) => `url('./${file}')`)
      .replace(
        /unicode-range:\s*[^;}\n]+/,
        () => `unicode-range: ${codesToRange(face.codes)}`,
      )
      .trim();
    cssParts.push(`@font-face {${block}}`);
  }
  fs.writeFileSync(OUT_CSS, `${cssParts.join('\n')}\n`);

  fs.writeFileSync(
    OUT_MANIFEST,
    `${JSON.stringify(
      {
        bytes: subsetBytes,
        charsetHash,
        faces: kept.map((face) => face.file),
        sourceBytes,
        sourceHash,
        subsettedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  log('');
  log(`✔ 字体子集化完成`);
  log(`  字族：${[...families].join(', ')}`);
  log(
    `  分片：保留 ${kept.length}，丢弃 ${skipped}（无项目用字）${droppedChars > 0 ? `，${droppedChars} 字因源文件缺失被跳过` : ''}`,
  );
  log(
    `  体积：${(sourceBytes / 1024 / 1024).toFixed(2)}MB → ${(subsetBytes / 1024).toFixed(0)}KB（省 ${((1 - subsetBytes / sourceBytes) * 100).toFixed(0)}%）`,
  );
  log(`  产物：${path.relative(APP_ROOT, OUT_DIR)}`);
}

await main();
