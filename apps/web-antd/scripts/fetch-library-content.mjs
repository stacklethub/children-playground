#!/usr/bin/env node
/**
 * 从 WorkBuddy 资料库拉取「幼儿学习内容」表格，生成 `src/data/library-content.json`。
 *
 * 为什么要这一步：宝宝端最终产物是**单文件 HTML**（`build:singlefile`），双击用
 * `file://` 打开时没有登录态、也受同源策略限制，**运行时无法访问资料库接口**。
 * 因此改为构建时把表格拉下来编译进产物 —— 产物离线可用，家长改完表格重新构建即生效。
 *
 * 读取通道：复用 library skill 的 `database/query_database_record.py`。脚本进程内不持有
 * 任何凭证，认证由 WorkBuddy 宿主通道（wbipc）注入，所以**必须在 WorkBuddy 客户端环境运行**。
 *
 * 职责边界：本脚本只负责「拉数据 + 落盘原始行」；**记录 → 内容类型的解析由
 * `src/data/library-parse.ts` 承担**（单一事实源，避免两套解析规则漂移）。
 *
 * 实现细节：走「python 直接写文件、node 读文件」而不是管道回传 ——
 * 本机沙箱下 `execFileSync` 回传大 stdout 会偶发 `spawnSync … EBUSY`。
 *
 * 用法：
 *   node scripts/fetch-library-content.mjs                 # 拉取
 *   node scripts/fetch-library-content.mjs --check         # 只校验现有产物
 *   node scripts/fetch-library-content.mjs --allow-stale   # 拉取失败时沿用旧产物
 *
 * 环境变量：
 *   LIBRARY_DATABASE_ID          覆盖表格 id
 *   LIBRARY_PYTHON               指定 python 可执行文件
 *   WORKBUDDY_LIBRARY_SKILL_DIR  覆盖 library skill 目录
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(HERE, '..');
const OUT_FILE = resolve(APP_DIR, 'src/data/library-content.json');

/** 「幼儿学习内容」表格 id；家长另建表格时可改这里或传环境变量 */
const DEFAULT_DATABASE_ID = '1RiEuUHmGeqGKWTNBL2ahv';

const LIBRARY_SKILL_DIR = resolve(
  process.env.WORKBUDDY_LIBRARY_SKILL_DIR ??
    'D:/Program Files/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library',
);

const args = new Set(process.argv.slice(2));

function log(message) {
  process.stdout.write(`[fetch-content] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[fetch-content] ✖ ${message}\n`);
  process.exit(1);
}

/** 按「文件是否存在」挑 python，不预跑探测（连续建进程在 Windows 上会偶发 EBUSY） */
function resolvePython() {
  const candidates = [
    process.env.LIBRARY_PYTHON,
    resolve(
      process.env.USERPROFILE ?? '',
      '.workbuddy/binaries/python/versions/3.13.12/python.exe',
    ),
    'python3',
    'python',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!candidate.includes('/') && !candidate.includes('\\')) return candidate;
    if (existsSync(candidate)) return candidate;
  }
  return fail('找不到可用的 python；请设置 LIBRARY_PYTHON 环境变量');
}

function readExisting() {
  if (!existsSync(OUT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(OUT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

if (args.has('--check')) {
  const payload = readExisting();
  if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0) {
    fail(`产物缺失或为空：${OUT_FILE}`);
  }
  log(
    `✓ 现有产物可用：${payload.rows.length} 行（拉取于 ${payload.fetchedAt}）`,
  );
  process.exit(0);
}

const databaseId = process.env.LIBRARY_DATABASE_ID ?? DEFAULT_DATABASE_ID;

if (!existsSync(LIBRARY_SKILL_DIR)) {
  fail(`未找到 library skill 目录：${LIBRARY_SKILL_DIR}`);
}

const queryScript = resolve(
  LIBRARY_SKILL_DIR,
  'database/query_database_record.py',
);
if (!existsSync(queryScript)) fail(`未找到查询脚本：${queryScript}`);

const python = resolvePython();
const dumpFile = resolve(APP_DIR, 'node_modules/.cache/library-rows.json');
mkdirSync(dirname(dumpFile), { recursive: true });

// 让 python 分页拉全量并直接写 JSON 文件；node 只读结果文件。
// 用 tempfile + 原子替换，避免半截文件被读成合法 JSON。
const pythonDump = `
import json, os, subprocess, sys, tempfile

QUERY = ${JSON.stringify(queryScript)}
DB = ${JSON.stringify(databaseId)}
OUT = ${JSON.stringify(dumpFile)}
PY = sys.executable

rows, cursor = [], ""
for _ in range(50):
    cmd = [PY, QUERY, "--database-id", DB, "--page-size", "100"]
    if cursor:
        cmd += ["--start-cursor", cursor]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if proc.returncode != 0:
        print("QUERY_FAILED:" + (proc.stderr or proc.stdout or "").strip(), file=sys.stderr)
        sys.exit(3)
    try:
        payload = json.loads(proc.stdout)
    except Exception as exc:
        print("BAD_JSON:" + str(exc), file=sys.stderr)
        sys.exit(4)
    if payload.get("error"):
        print("API_ERROR:" + str(payload["error"]), file=sys.stderr)
        sys.exit(5)
    rows.extend(payload.get("results") or [])
    if not payload.get("has_more") or not payload.get("next_cursor"):
        break
    cursor = str(payload["next_cursor"])

clean = []
for row in rows:
    row.pop("_id", None)
    row.pop("record_id", None)
    clean.append(row)

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT), suffix=".tmp")
with os.fdopen(fd, "w", encoding="utf-8") as fh:
    json.dump({"rows": clean}, fh, ensure_ascii=False)
os.replace(tmp, OUT)
print("ROWS=" + str(len(clean)))
`;

log(`拉取表格 ${databaseId} …`);

const result = spawnSync(python, ['-c', pythonDump], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

let rows;
if (result.status !== 0 || !existsSync(dumpFile)) {
  const detail = (
    result.stderr ||
    result.stdout ||
    result.error?.message ||
    ''
  ).trim();
  if (args.has('--allow-stale') && readExisting()) {
    log(`⚠ 拉取失败（${detail.slice(0, 200)}），沿用已有产物`);
    process.exit(0);
  }
  fail(
    `拉取失败：${detail.slice(0, 400)}\n` +
      '  该通道依赖 WorkBuddy 客户端登录态，请在客户端环境重跑；\n' +
      '  或加 --allow-stale 沿用上一次的产物。',
  );
}

try {
  rows = JSON.parse(readFileSync(dumpFile, 'utf8')).rows;
} catch (error) {
  fail(`读取拉取结果失败：${error.message}`);
}
// 不删 dump 文件：它落在 node_modules/.cache 下（不受版本控制），
// 下次拉取会直接覆盖，而删除在多文件构建的同一轮里会累进沙箱的批量删除计数。

if (!Array.isArray(rows) || rows.length === 0) {
  if (args.has('--allow-stale') && readExisting()) {
    log('⚠ 表格为空，沿用已有产物');
    process.exit(0);
  }
  fail('表格里没有任何记录');
}

const payload = {
  databaseId,
  fetchedAt: new Date().toISOString(),
  rows,
};
writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const byModule = new Map();
for (const row of rows) {
  const key = row['模块'] ?? '(未分类)';
  byModule.set(key, (byModule.get(key) ?? 0) + 1);
}
log(`✓ 生成 ${OUT_FILE}（${rows.length} 行）`);
log(`  ${[...byModule.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`);
