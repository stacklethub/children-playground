/**
 * 题库仓库：把「家长编辑的题库覆盖项」持久化到 IndexedDB，
 * 作为无后端模式下「题库 JSON 化」的主副本。
 *
 * 数据流：
 * - 家长在内容管理页编辑 → 写 kidStore.contentOverrides（响应式，即时生效）
 *   → 同时落一份到 IndexedDB（题库主副本）；
 * - 导出 = 从 IndexedDB 读题库 + 其他数据 → 打包 JSON；
 * - 导入 = JSON 解包 → 写 IndexedDB + 回填 kidStore；
 * - 绑定文件 = JSON 文件 ↔ IndexedDB 双向同步。
 *
 * IndexedDB 相比 localStorage 的优势：容量更大、结构化读写，
 * 适合承载题库这类可能持续增长的家长自定义内容。
 */

import type { ContentOverrides } from '#/data/migrate-content-overrides';

import { dbGet, dbSet } from '#/utils/local-db';

const CONTENT_KEY = 'repo:content-overrides';

/** 读题库覆盖项（无则返回空对象） */
export async function loadContentOverrides(): Promise<ContentOverrides> {
  return (await dbGet<ContentOverrides>(CONTENT_KEY)) ?? {};
}

/** 写题库覆盖项（导入 / 每次编辑后同步落库） */
export async function saveContentOverrides(
  overrides: ContentOverrides,
): Promise<void> {
  await dbSet(CONTENT_KEY, overrides);
}
