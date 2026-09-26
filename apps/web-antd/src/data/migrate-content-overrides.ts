import { TILE_KEYS } from './modules';

/** 覆盖项：模块 key → 条目 id → patch */
export type ContentOverrides = Record<string, Record<string, unknown>>;

const KNOWN_KEYS = new Set<string>(TILE_KEYS);

/**
 * 兼容旧持久化数据。
 *
 * `contentOverrides` 在支持多模块前是「卡片 id → patch」的扁平结构，
 * 现在改为「模块 key → 卡片 id → patch」。
 *
 * 判定规则：顶层出现任一已知模块 key 即视为新结构；否则视为旧结构，
 * 整体搬入 `cards`。无法识别的输入返回空对象，绝不抛错 —— 迁移失败
 * 不应该让应用起不来。
 */
export function migrateContentOverrides(input: unknown): ContentOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const raw = input as ContentOverrides;
  const keys = Object.keys(raw);
  if (keys.length === 0) return {};

  if (keys.some((key) => KNOWN_KEYS.has(key))) return raw;

  return { cards: raw };
}
