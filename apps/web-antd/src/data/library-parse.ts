/**
 * 资料库表格记录 → 宝宝端学习内容的解析器。
 *
 * 数据源是 WorkBuddy 资料库里的「幼儿学习内容」表格（家长可在网页上直接编辑），
 * 构建时由 `scripts/fetch-library-content.mjs` 拉取，产出 `library-content.json`。
 *
 * 本文件是**纯函数**，不碰网络与 fs，便于单测与在浏览器侧复用：
 * 1. 表格只有一张，靠「模块」列区分条目属于哪个学习模块；
 * 2. 表格是「宽表」，各模块用的列不同，空列不会出现；
 * 3. 所有字段都可能是缺失的（家长新增行时只填几个必需列），因此逐字段兜底，
 *    **单行解析失败只丢这一行**，不能让整份内容挂掉。
 *
 * ⚠️ 表头是中文，与代码里的英文类型字段的对应关系集中在各 parse 函数里。
 */

import type {
  KidCard,
  KidLetter,
  KidLevel,
  KidLogicItem,
  KidNumber,
  KidPinyin,
  KidPoem,
} from './content';

/** 表格的「模块」列取值（select 字段的选项文本）→ 内容类型 */
export const MODULE_COLUMN_TO_KEY = {
  中文乐园: 'pinyin',
  看图识物: 'cards',
  古诗花园: 'poems',
  英文乐园: 'letters',
  数字王国: 'numbers',
  逻辑挑战: 'logic',
  闯关冒险: 'adventure',
} as const;

export type LibraryContentKey =
  (typeof MODULE_COLUMN_TO_KEY)[keyof typeof MODULE_COLUMN_TO_KEY];

/** 表格一行（列名 → 单元格值）；单元格值已被拉取脚本扁平成标量或字符串 */
export type LibraryRow = Record<string, unknown>;

/** 英文乐园条目的实际形状：`KidLetter` 没有 id，集合里需要用字母本身作 id */
export type LibraryLetterItem = KidLetter & { id: string };

/** 解析产物：模块 key → 该模块的条目。缺失的模块不出现在对象里 */
export interface LibraryContent {
  adventure?: KidLevel[];
  cards?: KidCard[];
  letters?: LibraryLetterItem[];
  logic?: KidLogicItem[];
  numbers?: KidNumber[];
  pinyin?: KidPinyin[];
  poems?: KidPoem[];
}

/** 取字符串单元格，去首尾空白；非字符串一律转成字符串后再修整（数字列也能安全读） */
function str(row: LibraryRow, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** 取数字单元格；非法值回落到 fallback */
function num(row: LibraryRow, column: string, fallback: number): number {
  const raw = str(row, column);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 把多行文本拆成数组。
 * 表格里的「选项」「正文」都按行录入（换行分隔），也容忍家长用逗号/分号分隔，
 * 因此先按换行切，再对只有一行的情况按中英文逗号、分号切一次。
 */
export function splitCellLines(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];
  const byLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  return text
    .split(/[,，;；]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 「启用」列是 checkbox，未勾选（false / 空）的条目视为下架。
 * 缺列时按启用处理 —— 家长只想临时停用才会去取消勾选。
 */
function isEnabled(row: LibraryRow): boolean {
  const raw = row['启用'];
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw === 'boolean') return raw;
  const text = String(raw).trim().toLowerCase();
  return !['0', 'false', 'no', 'off', '停用', '否'].includes(text);
}

// ---------- 各模块解析 ----------

function parseCards(rows: LibraryRow[]): KidCard[] {
  const out: KidCard[] = [];
  for (const row of rows) {
    const id = str(row, 'ID');
    const name = str(row, '名称');
    if (!id || !name) continue;
    out.push({
      categoryId: str(row, '分类') || 'animals',
      emoji: str(row, '表情'),
      fact: str(row, '小知识') || undefined,
      id,
      name,
      pinyin: str(row, '拼音'),
    });
  }
  return out;
}

/** 中文乐园：题型 hanzi = 认汉字，pinyin = 声母/韵母字形（缺省） */
function parsePinyin(rows: LibraryRow[]): KidPinyin[] {
  const out: KidPinyin[] = [];
  for (const row of rows) {
    const id = str(row, 'ID');
    const name = str(row, '名称');
    if (!id || !name) continue;
    const kind = str(row, '题型') === 'hanzi' ? 'hanzi' : 'pinyin';
    out.push({
      emoji: str(row, '表情'),
      hanzi: name,
      id,
      kind,
      pinyin: str(row, '拼音'),
    });
  }
  return out;
}

/**
 * 英文乐园：表格「名称」列存的是单词（如 apple），「ID」是大写字母（如 A）。
 * 内容层不带 id，条目 id 借用字母本身（与内置数据一致），故 letters 解析成带 id 的形状。
 */
function parseLetters(rows: LibraryRow[]): (KidLetter & { id: string })[] {
  const out: (KidLetter & { id: string })[] = [];
  for (const row of rows) {
    const letter = str(row, 'ID');
    if (!letter) continue;
    out.push({
      emoji: str(row, '表情'),
      id: letter,
      letter,
      lower: str(row, '小写'),
      sentence: str(row, '例句'),
      word: str(row, '名称'),
      zh: str(row, '释义'),
    });
  }
  return out;
}

function parsePoems(rows: LibraryRow[]): KidPoem[] {
  const out: KidPoem[] = [];
  for (const row of rows) {
    const id = str(row, 'ID');
    const title = str(row, '名称');
    if (!id || !title) continue;
    out.push({
      author: str(row, '作者'),
      emoji: str(row, '表情'),
      id,
      lines: splitCellLines(str(row, '正文')),
      title,
    });
  }
  return out;
}

function parseNumbers(rows: LibraryRow[]): KidNumber[] {
  const out: KidNumber[] = [];
  for (const row of rows) {
    const numValue = num(row, '数字', Number.NaN);
    const word = str(row, '名称');
    if (!Number.isFinite(numValue) || !word) continue;
    out.push({
      count: num(row, '数量', numValue),
      emoji: str(row, '表情'),
      num: numValue,
      word,
    });
  }
  return out;
}

const LOGIC_KINDS = new Set(['compare', 'match', 'pattern', 'sort']);

function parseLogic(rows: LibraryRow[]): KidLogicItem[] {
  const out: KidLogicItem[] = [];
  for (const row of rows) {
    const id = str(row, 'ID');
    const prompt = str(row, '题干');
    const options = splitCellLines(str(row, '选项'));
    const answer = str(row, '答案');
    // 选项至少两个、答案必须是选项之一，否则这题在宝宝端无法作答
    if (!id || !prompt || options.length < 2 || !options.includes(answer)) {
      continue;
    }
    const kind = str(row, '题型');
    out.push({
      answer,
      id,
      kind: (LOGIC_KINDS.has(kind) ? kind : 'pattern') as KidLogicItem['kind'],
      options,
      prompt,
    });
  }
  return out;
}

function parseLevels(rows: LibraryRow[]): KidLevel[] {
  const out: KidLevel[] = [];
  for (const row of rows) {
    const id = str(row, 'ID');
    const title = str(row, '名称');
    if (!id || !title) continue;
    const modules = splitCellLines(str(row, '考察模块'));
    out.push({
      emoji: str(row, '表情'),
      id,
      modules: modules.length > 0 ? modules : ['logic'],
      questionCount: Math.max(1, num(row, '题目数量', 3)),
      title,
    });
  }
  return out;
}

/**
 * 主入口：把表格全量记录解析成各模块内容。
 *
 * @param rows 表格记录（已扁平化，见拉取脚本）
 * @returns 只包含「表格里出现过且有有效条目」的模块 —— 调用方据此判断
 *          某模块该用表格数据还是回落内置题库，空数组也要能区分出来
 */
export function parseLibraryContent(rows: LibraryRow[]): LibraryContent {
  const buckets: Record<LibraryContentKey, LibraryRow[]> = {
    adventure: [],
    cards: [],
    letters: [],
    logic: [],
    numbers: [],
    pinyin: [],
    poems: [],
  };

  for (const row of rows) {
    if (!isEnabled(row)) continue;
    const column = str(row, '模块');
    const key =
      MODULE_COLUMN_TO_KEY[column as keyof typeof MODULE_COLUMN_TO_KEY];
    if (!key) continue;
    buckets[key].push(row);
  }

  // 注意：判据是**解析后有效条目数**而非表格行数 ——
  // 有行但全被丢掉的模块（如只填了标题没填 ID）必须整键缺席，
  // 否则调用方会以为「表格接管了这个模块」从而拿到空列表、把内置题库挡住。
  const content: LibraryContent = {};
  const put = <K extends keyof LibraryContent>(
    key: K,
    items: NonNullable<LibraryContent[K]>,
  ) => {
    if (items.length > 0) content[key] = items;
  };
  put('cards', parseCards(buckets.cards));
  put('pinyin', parsePinyin(buckets.pinyin));
  put('letters', parseLetters(buckets.letters));
  put('poems', parsePoems(buckets.poems));
  put('numbers', parseNumbers(buckets.numbers));
  put('logic', parseLogic(buckets.logic));
  put('adventure', parseLevels(buckets.adventure));
  return content;
}
