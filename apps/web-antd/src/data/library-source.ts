/**
 * 学习内容的「数据源装配」：资料库表格（构建时拉取）为主，内置题库兜底。
 *
 * 背景：宝宝端产物是单文件 HTML，`file://` 打开时无法访问资料库接口，
 * 因此表格内容在**构建时**由 `scripts/fetch-library-content.mjs` 拉取、写进
 * `library-content.json`，这里再经 `library-parse.ts` 解析成本地常量。
 *
 * 三条规则：
 * 1. **模块级**：表格里该模块有有效条目 → 用表格的；该模块缺失/全无效 → 回落内置；
 * 2. **条目级**：家长端的 `contentOverrides`（增/改/删）叠加在选中的基座之上，
 *    所以「表格定基调 + 家长本地微调」可以共存；
 * 3. **失败降级**：JSON 缺失、损坏、结构不对（都只可能由构建异常导致）→ 整体回落内置，
 *    绝不因为内容源问题让宝宝端打不开。
 *
 * ⚠️ 表格对某模块是**整体替换**，不做「内置 + 表格」并集 ——
 * 否则家长在表格里删掉一条，宝宝端仍会从内置题库把它漏回来。
 *
 * ⚠️ `library-content.json` **需要进版本控制**（故意不 gitignore）：
 * 它让没有 WorkBuddy 登录态的环境（CI、同事的机器）也能构建出带内容的产物，
 * 同时给 `build:singlefile` 的 `--allow-stale` 一个可用的兜底。
 * 家长改完表格后跑 `pnpm -F @vben/web-antd run fetch:content` 刷新它。
 */

import type {
  KidCard,
  KidLevel,
  KidLogicItem,
  KidNumber,
  KidPinyin,
  KidPoem,
} from './content';
import type {
  LibraryContent,
  LibraryLetterItem,
  LibraryRow,
} from './library-parse';

import {
  kidCards,
  kidLetters,
  kidLevels,
  kidLogicItems,
  kidNumbers,
  kidPinyin,
  kidPoems,
} from './content';
import libraryContentRaw from './library-content.json';
import { parseLibraryContent } from './library-parse';

/** 与内置英文条目同构：字母本身作 id */
export type LetterItem = LibraryLetterItem;

/** 表格产物文件的形状 */
interface LibraryContentFile {
  databaseId?: string;
  fetchedAt?: string;
  rows?: LibraryRow[];
}

const FILE = libraryContentRaw as LibraryContentFile;

/** 内置题库里的英文条目（id 借用字母本身） */
const BUILTIN_LETTERS: LetterItem[] = kidLetters.map((item) => ({
  ...item,
  id: item.letter,
}));

/**
 * 解析构建产物；任何异常都视为「没有表格数据」，由调用方回落内置。
 *
 * 只在**异常情况**下出声（warn/error）：「正常走内置题库」是绝大多数本地开发
 * 场景的常态，每次启动都打日志会把控制台吵满。
 * 内容来源随时可在家长端「内容管理」页看到，不必占用启动日志。
 */
function loadLibraryContent(): LibraryContent | null {
  try {
    const rows = FILE.rows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const content = parseLibraryContent(rows);
    const total = Object.values(content).reduce(
      (sum, items) => sum + (items?.length ?? 0),
      0,
    );
    if (total === 0) {
      console.warn('[content] 资料库表格解析后没有任何有效条目，回落内置题库');
      return null;
    }
    return content;
  } catch (error) {
    console.error('[content] 资料库内容解析失败，回落内置题库', error);
    return null;
  }
}

const LIBRARY = loadLibraryContent();

/** 选中的基座内容（表格优先，否则内置） */
const DEFAULTS = {
  adventure: LIBRARY?.adventure ?? kidLevels,
  cards: LIBRARY?.cards ?? kidCards,
  letters: LIBRARY?.letters ?? BUILTIN_LETTERS,
  logic: LIBRARY?.logic ?? kidLogicItems,
  numbers: LIBRARY?.numbers ?? kidNumbers,
  pinyin: LIBRARY?.pinyin ?? kidPinyin,
  poems: LIBRARY?.poems ?? kidPoems,
};

/** 各模块当前用的是表格还是内置 —— 家长端「内容来源」展示用 */
export const libraryContentMeta = {
  /** 是否至少有一个模块由表格提供 */
  active: LIBRARY !== null,
  databaseId: FILE.databaseId ?? '',
  fetchedAt: FILE.fetchedAt ?? '',
  rowCount: Array.isArray(FILE.rows) ? FILE.rows.length : 0,
  /** 模块 key → 'library' | 'builtin'，供家长端逐模块标注来源 */
  sourceOf: {
    adventure: LIBRARY?.adventure ? 'library' : 'builtin',
    cards: LIBRARY?.cards ? 'library' : 'builtin',
    letters: LIBRARY?.letters ? 'library' : 'builtin',
    logic: LIBRARY?.logic ? 'library' : 'builtin',
    numbers: LIBRARY?.numbers ? 'library' : 'builtin',
    pinyin: LIBRARY?.pinyin ? 'library' : 'builtin',
    poems: LIBRARY?.poems ? 'library' : 'builtin',
  } as Record<string, 'builtin' | 'library'>,
};

/** 内容管理可管理的模块（与 useContent 的 BUILTIN 映射对齐） */
export type ManagedContentKey = keyof Pick<
  typeof DEFAULTS,
  'adventure' | 'cards' | 'letters' | 'logic' | 'pinyin' | 'poems'
>;

interface ManagedDefaults {
  adventure: KidLevel[];
  cards: KidCard[];
  letters: LetterItem[];
  logic: KidLogicItem[];
  pinyin: KidPinyin[];
  poems: KidPoem[];
}

/**
 * 单个模块的基座（家长端内容管理按模块取用）。
 *
 * 用「key 泛型 + 映射类型」而不是联合返回类型：调用方 `useCollection<T>({defaults})`
 * 依赖 defaults 的精确类型，联合类型会让 T 推断失败（每个集合都报 TS2322）。
 */
export function moduleDefaults<K extends ManagedContentKey>(
  key: K,
): ManagedDefaults[K] {
  return DEFAULTS[key] as ManagedDefaults[K];
}

/** 数字模块的基座（不参与家长端编辑，仅受难度范围限制） */
export function numberDefaults(): KidNumber[] {
  return DEFAULTS.numbers as KidNumber[];
}

export type { KidCard, KidLevel, KidLogicItem, KidNumber, KidPinyin, KidPoem };
