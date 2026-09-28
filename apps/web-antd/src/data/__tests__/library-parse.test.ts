import { describe, expect, it } from 'vitest';

import { parseLibraryContent, splitCellLines } from '../library-parse';

/**
 * 取列表首项；断言阶段列表一定非空。
 * 用辅助函数而不是 `list[0]!`：`noUncheckedIndexedAccess` 下解构会带上
 * `possibly undefined`，逐处 `!` 会让断言读起来更吵。
 */
function first<T>(list: T[] | undefined): T {
  if (!list || list.length === 0) {
    throw new Error('期望列表非空，但拿到空列表');
  }
  return list[0] as T;
}

/**
 * 解析器的契约：表格是家长直接在网页上编辑的宽表，
 * 任何一行的字段缺失/写坏都不该拖垮整份内容。
 */
describe('splitCellLines', () => {
  it('按换行拆行', () => {
    expect(splitCellLines('🍎\n🍌\n🍇')).toEqual(['🍎', '🍌', '🍇']);
  });

  it('只有一行时按中英文逗号/分号兜底拆', () => {
    expect(splitCellLines('🍎，🍌，🍇')).toEqual(['🍎', '🍌', '🍇']);
    expect(splitCellLines('🍎,🍌;🍇')).toEqual(['🍎', '🍌', '🍇']);
  });

  it('过滤空行与首尾空白', () => {
    expect(splitCellLines('  春眠不觉晓  \n\n  处处闻啼鸟 ')).toEqual([
      '春眠不觉晓',
      '处处闻啼鸟',
    ]);
  });

  it('空串返回空数组', () => {
    expect(splitCellLines('')).toEqual([]);
    expect(splitCellLines('   ')).toEqual([]);
  });
});

describe('parseLibraryContent', () => {
  const rows = [
    {
      ID: 'b1',
      分类: 'fruits',
      名称: '苹果',
      启用: true,
      小知识: '苹果红红的',
      拼音: 'píng guǒ',
      模块: '看图识物',
      表情: '🍎',
    },
    {
      ID: 'b2',
      名称: '被停用的卡片',
      启用: false,
      模块: '看图识物',
    },
    {
      ID: 'A',
      名称: 'apple',
      启用: true,
      小写: 'a',
      例句: 'I eat an apple.',
      释义: '苹果',
      模块: '英文乐园',
      表情: '🍎',
    },
    {
      ID: '1',
      名称: '一',
      启用: true,
      数字: 1,
      数量: 1,
      模块: '数字王国',
      表情: '🍎',
    },
    {
      ID: 'poem-1',
      作者: '李白',
      名称: '静夜思',
      启用: true,
      正文: '床前明月光\n疑是地上霜',
      模块: '古诗花园',
      表情: '🌙',
    },
    {
      ID: 'lg-1',
      启用: true,
      模块: '逻辑挑战',
      答案: '🍎',
      选项: '🍎\n🍌',
      题型: 'pattern',
      题干: '🍎🍌🍎🍌，后面是？',
    },
    {
      ID: 'p-b',
      名称: '爸爸',
      启用: true,
      拼音: 'b',
      模块: '中文乐园',
      表情: '👨',
      题型: 'pinyin',
    },
    {
      ID: 'lv1',
      名称: '小小起步',
      启用: true,
      模块: '闯关冒险',
      考察模块: 'logic',
      表情: '🌱',
      题目数量: 3,
    },
  ];

  it('按模块列分派到各内容类型', () => {
    const content = parseLibraryContent(rows);
    expect(content.cards).toHaveLength(1);
    expect(content.letters).toHaveLength(1);
    expect(content.numbers).toHaveLength(1);
    expect(content.poems).toHaveLength(1);
    expect(content.logic).toHaveLength(1);
    expect(content.pinyin).toHaveLength(1);
    expect(content.adventure).toHaveLength(1);
  });

  it('未勾选「启用」的条目被过滤掉', () => {
    const content = parseLibraryContent(rows);
    expect(content.cards?.map((c) => c.id)).toEqual(['b1']);
  });

  it('看图识物映射 categoryId / emoji / pinyin 与可选小知识', () => {
    const card = first(parseLibraryContent(rows).cards);
    expect(card).toEqual({
      categoryId: 'fruits',
      emoji: '🍎',
      fact: '苹果红红的',
      id: 'b1',
      name: '苹果',
      pinyin: 'píng guǒ',
    });
  });

  it('英文乐园的 id 借用字母本身（与内置数据同构）', () => {
    const letter = first(parseLibraryContent(rows).letters);
    expect(letter.id).toBe('A');
    expect(letter.letter).toBe('A');
    expect(letter.lower).toBe('a');
    expect(letter.word).toBe('apple');
  });

  it('古诗正文按行拆成 lines', () => {
    const poem = first(parseLibraryContent(rows).poems);
    expect(poem.lines).toEqual(['床前明月光', '疑是地上霜']);
  });

  it('逻辑题的选项按行拆，答案原样保留', () => {
    const item = first(parseLibraryContent(rows).logic);
    expect(item.options).toEqual(['🍎', '🍌']);
    expect(item.answer).toBe('🍎');
    expect(item.kind).toBe('pattern');
  });

  it('中文乐园缺省题型视为拼音（pinyin）', () => {
    const pinyin = first(
      parseLibraryContent([
        { ID: 'p-a', 名称: 'a', 模块: '中文乐园', 拼音: 'a' },
      ]).pinyin,
    );
    expect(pinyin.kind).toBe('pinyin');
    expect(pinyin.hanzi).toBe('a');
  });

  it('数字王国把数字/数量转成 number', () => {
    const number = first(parseLibraryContent(rows).numbers);
    expect(number.num).toBe(1);
    expect(number.count).toBe(1);
    expect(number.word).toBe('一');
  });

  it('闯关冒险的考察模块与题数规范化', () => {
    const level = first(parseLibraryContent(rows).adventure);
    expect(level.modules).toEqual(['logic']);
    expect(level.questionCount).toBe(3);
  });

  // ---- 容错：单行坏数据只丢这一行 ----

  it('缺少必需列的条目被丢弃，不影响其他行', () => {
    const content = parseLibraryContent([
      { 名称: '没 ID', 模块: '看图识物' },
      { ID: 'ok', 名称: '有 ID', 模块: '看图识物' },
    ]);
    expect(content.cards?.map((c) => c.id)).toEqual(['ok']);
  });

  it('选项少于 2 个或答案不在选项里的逻辑题被丢弃', () => {
    const content = parseLibraryContent([
      { ID: 'x', 答案: '🍎', 模块: '逻辑挑战', 选项: '🍎', 题干: '只有一项' },
      {
        ID: 'y',
        答案: '🍇',
        模块: '逻辑挑战',
        选项: '🍎\n🍌',
        题干: '答案不在选项',
      },
      { ID: 'z', 答案: '🍎', 模块: '逻辑挑战', 选项: '🍎\n🍌', 题干: '正常' },
    ]);
    expect(content.logic?.map((i) => i.id)).toEqual(['z']);
  });

  it('未知模块列被忽略', () => {
    const content = parseLibraryContent([
      { ID: 'x', 名称: '未来模块', 模块: '未来乐园' },
    ]);
    expect(content).toEqual({});
  });

  it('某模块全是无效行时不产生该键（调用方可据此回落内置题库）', () => {
    const content = parseLibraryContent([{ 模块: '看图识物' }]);
    expect(content.cards).toBeUndefined();
  });

  it('空输入返回空对象', () => {
    expect(parseLibraryContent([])).toEqual({});
  });
});
