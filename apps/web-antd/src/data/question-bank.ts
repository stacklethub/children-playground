/**
 * 全量题库构建：把「内置题库 + 家长覆盖项」合并成一份扁平的全量题目数组，
 * 供导出 JSON 使用（与学习记录数组对称，形成两个清晰的数据集）。
 *
 * 导出时用本文件把运行时题库物化成自包含的题目列表；导入时仍以
 * `contentOverrides` 作为精确回写来源（见 data-snapshot.ts / use-data-manager.ts）。
 *
 * ⚠️ 本文件是纯函数，不依赖 pinia —— 合并语义复用 use-collection 的
 * `mergeCollection`，与宝宝端 / 家长端运行时看到的内容严格一致。
 */

import type { ContentOverrides } from './migrate-content-overrides';
import type { LearnModule } from './modules';

import {
  kidCards,
  kidCategories,
  kidLetters,
  kidLevels,
  kidLogicItems,
  kidNumbers,
  kidPinyin,
  kidPoems,
  kidSongs,
} from './content';
import { mergeCollection } from './use-collection';

/** 一道题目的通用形状：所属模块 + 内容字段 */
export interface BankQuestion {
  module: LearnModule;
  [key: string]: unknown;
}

/** 英文乐园条目：字母天然唯一，借用 letter 作 id（与 use-content 的 LETTER_ITEMS 一致） */
function letterItems() {
  return kidLetters.map((item) => ({ ...item, id: item.letter }));
}

/** 各模块「内置内容 + 覆盖项」合并后的题目数组 */
export function buildQuestionBank(overrides: ContentOverrides): BankQuestion[] {
  const bank: BankQuestion[] = [];

  const pushModule = (module: LearnModule, items: object[]) => {
    for (const item of items) {
      bank.push({ module, ...item });
    }
  };

  pushModule(
    'cards',
    mergeCollection(kidCards, (overrides.cards ?? {}) as never),
  );
  pushModule(
    'letters',
    mergeCollection(letterItems(), (overrides.letters ?? {}) as never),
  );
  pushModule(
    'pinyin',
    mergeCollection(kidPinyin, (overrides.pinyin ?? {}) as never),
  );
  pushModule(
    'poems',
    mergeCollection(kidPoems, (overrides.poems ?? {}) as never),
  );
  pushModule(
    'logic',
    mergeCollection(kidLogicItems, (overrides.logic ?? {}) as never),
  );
  pushModule(
    'adventure',
    mergeCollection(kidLevels, (overrides.adventure ?? {}) as never),
  );

  // 无覆盖项的模块：直接导出内置内容
  pushModule('numbers', kidNumbers);
  pushModule('songs', kidSongs);

  return bank;
}

/** 分类（不是题目，但属于题库内容域，一并导出供参考） */
export function buildCategories() {
  return [...kidCategories];
}

/**
 * 各模块题目的「可读标签」字段：学习记录只存 itemId（关联），
 * 报告页展示时按 module + itemId 反查出这条可读文本。
 */
const LABEL_FIELD: Partial<Record<LearnModule, string>> = {
  adventure: 'title',
  cards: 'name',
  letters: 'word',
  logic: 'prompt',
  numbers: 'word',
  pinyin: 'hanzi',
  poems: 'title',
  songs: 'title',
};

/**
 * 构建「module:itemId → 可读标签」的索引（O(1) 反查）。
 * 数字王国的 itemId 是数字本身（`${num}`），索引用 num 作键。
 */
export function buildLabelIndex(
  overrides: ContentOverrides,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const q of buildQuestionBank(overrides)) {
    const field = LABEL_FIELD[q.module as LearnModule];
    if (!field) continue;
    const id =
      q.module === 'numbers'
        ? String((q as { num?: number }).num ?? '')
        : String((q as { id?: string }).id ?? '');
    const label = q[field];
    if (id && label !== null && label !== undefined) {
      index.set(`${q.module}:${id}`, String(label));
    }
  }

  return index;
}

/**
 * 按 module + itemId 反查题目的可读标签；查不到返回 undefined（调用方降级）。
 * 学习记录里的 detail 仅用于「运行时临时题」（考一考/算一算等无题库实体），
 * 内置题库题一律靠本函数反查，避免在记录里冗余存储题目内容。
 */
export function resolveItemLabel(
  module: string,
  itemId: string,
  index: Map<string, string>,
): string | undefined {
  return index.get(`${module}:${itemId}`);
}
