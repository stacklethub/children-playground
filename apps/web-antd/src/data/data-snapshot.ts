/**
 * 题库快照：把「内置默认题库 + 家长覆盖项」整体导出为 JSON，
 * 或从 JSON 导入回写 IndexedDB，作为家长端「导入 / 导出 / 绑定文件」的数据契约。
 *
 * 数据模型（无后端模式）：
 * - 内置默认题库仍在 `data/content.ts`（编译期内置，永不丢失）；
 * - 家长编辑产生 `contentOverrides`（覆盖项），与内置合并后即「当前题库」；
 * - 导出时把「覆盖项 + 孩子 + 设置 + 记录 + 错题 + 闯关进度」打包成一份 JSON；
 * - 导入时用 JSON 覆盖 IndexedDB 里的对应数据；
 * - 绑定本地文件时，JSON 文件是「主副本」，与 IndexedDB 双向同步。
 */

import type { BankQuestion } from './question-bank';

import type { ContentOverrides } from '#/data/migrate-content-overrides';

/** 导出的完整数据包版本号，升级结构时递增 */
export const SNAPSHOT_VERSION = 2;

/** 一份可导入/导出的完整数据快照 */
export interface DataSnapshot {
  version: number;
  exportedAt: number;
  /** 家长覆盖项（题库编辑结果）：模块 key → 条目 id → patch（导入回写的精确来源） */
  contentOverrides: ContentOverrides;
  /** 全量题库（内置 + 覆盖项合并）：扁平题目数组，与 records 形成两个独立数据集 */
  questions: BankQuestion[];
  /** 分类（题库内容域） */
  categories: unknown[];
  /** 孩子档案（本地，无后端） */
  children: unknown[];
  /** 学习记录 */
  records: unknown[];
  /** 错题本 */
  wrongBook: unknown;
  /** 模块设置（每日目标 / 顺序 / 难度） */
  moduleSettings: unknown;
  /** 闯关冒险进度 */
  adventureProgress: unknown;
}

/** 创建一个空的快照骨架 */
export function emptySnapshot(): DataSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    exportedAt: Date.now(),
    contentOverrides: {},
    questions: [],
    categories: [],
    children: [],
    records: [],
    wrongBook: {},
    moduleSettings: {},
    adventureProgress: {},
  };
}

/**
 * 校验并规范化导入的 JSON：结构不对时抛错（由调用方提示），
 * 字段缺失时用空值兜底，避免半截数据污染 IndexedDB。
 */
export function normalizeSnapshot(input: unknown): DataSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('invalid snapshot');
  }
  const raw = input as Partial<DataSnapshot>;
  return {
    version: SNAPSHOT_VERSION,
    exportedAt:
      typeof raw.exportedAt === 'number' ? raw.exportedAt : Date.now(),
    contentOverrides:
      raw.contentOverrides && typeof raw.contentOverrides === 'object'
        ? (raw.contentOverrides as ContentOverrides)
        : {},
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    children: Array.isArray(raw.children) ? raw.children : [],
    records: Array.isArray(raw.records) ? raw.records : [],
    wrongBook:
      raw.wrongBook && typeof raw.wrongBook === 'object' ? raw.wrongBook : {},
    moduleSettings:
      raw.moduleSettings && typeof raw.moduleSettings === 'object'
        ? raw.moduleSettings
        : {},
    adventureProgress:
      raw.adventureProgress && typeof raw.adventureProgress === 'object'
        ? raw.adventureProgress
        : {},
  };
}
