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
  'numbers',
  'songs',
] as const;

export type LearnModule = (typeof MODULE_KEYS)[number];

/** 首页磁贴：比可学习模块多出非学习入口（如「我的星星」） */
export const TILE_KEYS = [...MODULE_KEYS, 'rewards'] as const;

export type TileKey = (typeof TILE_KEYS)[number];

/**
 * content — 家长可完整增/改/删（配 fields）
 * param   — 家长可开关 + 设难度区间（配 range）
 * fixed   — 不可配置
 */
export type ModuleKind = 'content' | 'fixed' | 'param';

/** 该磁贴是否是可学习模块（rewards 等非学习入口返回 false） */
export function isLearnModule(key: TileKey): key is LearnModule {
  return (MODULE_KEYS as readonly string[]).includes(key);
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

export interface ModuleDef {
  key: TileKey;
  emoji: string;
  /** 宝宝端路由路径 */
  path: string;
  /** 首页磁贴底色 class */
  bg: string;
  /** 图表等场景用的十六进制主色，与 bg 同色系 */
  color: string;
  kind: ModuleKind;
  /** 每日目标默认值；非学习入口为 0 */
  defaultGoal: number;
  range?: { default: number; max: number; min: number };
  fields?: FieldDef[];
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
    kind: 'content',
    path: '/kid/cards',
  },
  letters: {
    bg: 'bg-sky-400',
    color: '#3B82F6',
    defaultGoal: 6,
    emoji: '🔤',
    key: 'letters',
    kind: 'param',
    path: '/kid/letters',
    range: { default: 26, max: 26, min: 6 },
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
    kind: 'content',
    path: '/kid/logic',
  },
  numbers: {
    bg: 'bg-emerald-400',
    color: '#10B981',
    defaultGoal: 6,
    emoji: '🔢',
    key: 'numbers',
    kind: 'param',
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
      { key: 'hanzi', labelKey: 'hanzi', type: 'text' },
      { key: 'emoji', labelKey: 'emoji', type: 'emoji' },
    ],
    key: 'pinyin',
    kind: 'content',
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
    kind: 'content',
    path: '/kid/poems',
  },
  songs: {
    bg: 'bg-violet-400',
    color: '#8B5CF6',
    defaultGoal: 2,
    emoji: '🎵',
    key: 'songs',
    kind: 'fixed',
    path: '/kid/songs',
  },
  rewards: {
    bg: 'bg-amber-400',
    color: '#F59E0B',
    defaultGoal: 0,
    emoji: '⭐',
    key: 'rewards',
    kind: 'fixed',
    path: '/kid/rewards',
  },
};
