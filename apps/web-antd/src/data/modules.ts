/**
 * 模块注册表：宝宝端与家长端共用的模块元信息**单一事实源**。
 *
 * 新增学习模块时，只需在 MODULE_KEYS 追加 key 并在 MODULES 补一条配置，
 * 首页磁贴、每日目标、家长端内容管理 Tab 与学习计划会自动跟随。
 *
 * ⚠️ 本文件不依赖 store，避免 store → data → store 的循环引用。
 */

import { kidCategories } from './content';

/** 可学习模块：参与每日目标、学习记录与星星统计 */
export const MODULE_KEYS = [
  'cards',
  'letters',
  'pinyin',
  'poems',
  'logic',
  'adventure',
  'numbers',
  'songs',
] as const;

export type LearnModule = (typeof MODULE_KEYS)[number];

/** 首页磁贴：比可学习模块多出非学习入口（如「我的星星」） */
export const TILE_KEYS = [...MODULE_KEYS, 'rewards'] as const;

export type TileKey = (typeof TILE_KEYS)[number];

/** 该磁贴是否是可学习模块（rewards 等非学习入口返回 false） */
export function isLearnModule(key: TileKey): key is LearnModule {
  return (MODULE_KEYS as readonly string[]).includes(key);
}

/**
 * 模块能力由「声明了什么」派生，而不是由单一的 kind 字段决定 ——
 * 这样同一个模块可以既能被家长编辑内容，又能调难度区间（如英文乐园）。
 *
 * 有 fields → 家长端内容管理出一个 Tab，可增/改/删
 * 有 range  → 家长端学习计划出开关 + 难度滑杆
 * 都没有    → 不可配置
 */
export function hasContentFields(def: ModuleDef): boolean {
  return (def.fields?.length ?? 0) > 0;
}

export function hasRange(def: ModuleDef): boolean {
  return Boolean(def.range);
}

/** 内容型模块在家长端表单里的字段声明 */
export interface FieldDef {
  key: string;
  /** i18n key，取值挂在 parent.content 下 */
  labelKey: string;
  type: 'emoji' | 'number' | 'select' | 'text' | 'textarea';
  required?: boolean;
  maxLength?: number;
  /** type === 'select' 时的选项来源 */
  options?: () => { label: string; value: string }[];
}

/** 把家长端逐行填写的文本切成数组（与 use-content 的规范化口径一致） */
export function splitLines(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface ModuleDef {
  key: TileKey;
  emoji: string;
  /** 宝宝端路由路径 */
  path: string;
  /** 首页磁贴底色 class */
  bg: string;
  /** 图表等场景用的十六进制主色，与 bg 同色系 */
  color: string;
  /** 每日目标默认值；非学习入口为 0 */
  defaultGoal: number;
  range?: { default: number; max: number; min: number };
  fields?: FieldDef[];
  /**
   * 跨字段校验：返回错误文案的 i18n key（可带插值参数），通过则返回 undefined。
   * 单个字段的必填/长度由 FieldDef 承担，这里只放 FieldDef 表达不了的约束
   * （如「正确答案必须属于选项」）。本文件不引 $t，翻译交给调用方。
   */
  validate?: (
    draft: Record<string, any>,
  ) => undefined | { key: string; params?: Record<string, unknown> };
}

export const MODULES: Record<TileKey, ModuleDef> = {
  cards: {
    bg: 'bg-orange-400',
    color: '#F97316',
    defaultGoal: 10,
    emoji: '🐘',
    fields: [
      { key: 'name', labelKey: 'name', required: true, type: 'text' },
      { key: 'pinyin', labelKey: 'pinyin', type: 'text' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
      {
        key: 'categoryId',
        labelKey: 'category',
        options: () =>
          kidCategories.map((c) => ({ label: c.name, value: c.id })),
        type: 'select',
      },
      { key: 'fact', labelKey: 'fact', type: 'textarea' },
    ],
    key: 'cards',
    path: '/kid/cards',
  },
  letters: {
    bg: 'bg-sky-400',
    color: '#3B82F6',
    defaultGoal: 6,
    emoji: '🔤',
    // 英文乐园同时是内容型与参数型：家长既能改单词/例句，也能限定学到第几个字母
    fields: [
      { key: 'letter', labelKey: 'letter', required: true, type: 'text' },
      { key: 'lower', labelKey: 'letterLower', required: true, type: 'text' },
      { key: 'word', labelKey: 'word', required: true, type: 'text' },
      { key: 'zh', labelKey: 'zh', required: true, type: 'text' },
      { key: 'sentence', labelKey: 'sentence', type: 'textarea' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
    ],
    key: 'letters',
    path: '/kid/letters',
    range: { default: 26, max: 26, min: 6 },
  },
  adventure: {
    bg: 'bg-fuchsia-500',
    color: '#D946EF',
    defaultGoal: 1,
    emoji: '🗺️',
    fields: [
      { key: 'title', labelKey: 'levelTitle', required: true, type: 'text' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
      { key: 'questionCount', labelKey: 'questionCount', type: 'number' },
      {
        key: 'modules',
        labelKey: 'levelModules',
        required: true,
        type: 'textarea',
      },
    ],
    key: 'adventure',
    path: '/kid/adventure',
    // 考察模块决定这一关能出什么题；填错或留空会让关卡永远停在 0/N 且无法通关
    validate: (draft) => {
      const modules = splitLines(draft.modules);
      if (modules.length === 0) return { key: 'parent.content.needOneModule' };
      const unknown = modules.filter(
        (key) => !(MODULE_KEYS as readonly string[]).includes(key),
      );
      return unknown.length > 0
        ? {
            key: 'parent.content.unknownModule',
            params: { keys: unknown.join(' / ') },
          }
        : undefined;
    },
  },
  logic: {
    bg: 'bg-cyan-500',
    color: '#06B6D4',
    defaultGoal: 4,
    emoji: '🧩',
    fields: [
      { key: 'prompt', labelKey: 'prompt', required: true, type: 'text' },
      {
        key: 'options',
        labelKey: 'options',
        required: true,
        type: 'textarea',
      },
      { key: 'answer', labelKey: 'answer', required: true, type: 'text' },
      {
        key: 'kind',
        labelKey: 'kind',
        // 题型名与 kidCategories 同属题库内容域，沿用中文单语的既有做法
        options: () => [
          { label: '找规律', value: 'pattern' },
          { label: '分类归类', value: 'sort' },
          { label: '比较排序', value: 'compare' },
          { label: '配对空间', value: 'match' },
        ],
        type: 'select',
      },
    ],
    key: 'logic',
    path: '/kid/logic',
    // 答案必须落在选项里，否则孩子端永远答不对（还会被扣光闯关的心）
    validate: (draft) => {
      const options = splitLines(draft.options);
      if (options.length < 2) return { key: 'parent.content.needTwoOptions' };
      return options.includes(String(draft.answer ?? '').trim())
        ? undefined
        : { key: 'parent.content.answerNotInOptions' };
    },
  },
  numbers: {
    bg: 'bg-emerald-400',
    color: '#10B981',
    defaultGoal: 6,
    emoji: '🔢',
    key: 'numbers',
    path: '/kid/numbers',
    range: { default: 10, max: 10, min: 5 },
  },
  pinyin: {
    bg: 'bg-rose-400',
    color: '#F43F5E',
    defaultGoal: 6,
    emoji: '🅰️',
    fields: [
      { key: 'pinyin', labelKey: 'pinyin', required: true, type: 'text' },
      // 例字是朗读与加星文案的来源，不能为空
      { key: 'hanzi', labelKey: 'hanzi', required: true, type: 'text' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
    ],
    key: 'pinyin',
    path: '/kid/pinyin',
  },
  poems: {
    bg: 'bg-lime-500',
    color: '#84CC16',
    defaultGoal: 1,
    emoji: '📜',
    fields: [
      { key: 'title', labelKey: 'poemTitle', required: true, type: 'text' },
      { key: 'author', labelKey: 'author', type: 'text' },
      { key: 'lines', labelKey: 'lines', required: true, type: 'textarea' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
    ],
    key: 'poems',
    path: '/kid/poems',
  },
  songs: {
    bg: 'bg-violet-400',
    color: '#8B5CF6',
    defaultGoal: 2,
    emoji: '🎵',
    key: 'songs',
    path: '/kid/songs',
  },
  rewards: {
    bg: 'bg-amber-400',
    color: '#F59E0B',
    defaultGoal: 0,
    emoji: '⭐',
    key: 'rewards',
    path: '/kid/rewards',
  },
};
