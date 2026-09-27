import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import type { TileKey } from './modules';

import { computed, toValue } from 'vue';

import { useKidStore } from '#/store';

export interface ContentItemBase {
  id: string;
}

/** 家长中心对单个条目的覆盖：改字段 / 新增标记 / 删除标记 */
export type ContentPatch<T> = Partial<T> & {
  added?: boolean;
  deleted?: boolean;
};

/** 覆盖项里 added / deleted 是集合自身的标记，不是内容字段，合并前必须剥掉 */
function fieldsOf<T>(patch: ContentPatch<T>): Partial<T> {
  const { added: _added, deleted: _deleted, ...fields } = patch;
  return fields as Partial<T>;
}

/**
 * 内置条目 + 覆盖项合并的纯函数（供 useCollection 与题库导出共用）：
 * 1. 遍历内置条目，`deleted` 的跳过，有 patch 的浅合并；
 * 2. 追加 `added` 的自定义条目，id 与内置项冲突时以已合并的内置项为准（不重复）。
 */
export function mergeCollection<T extends ContentItemBase>(
  defaults: T[],
  overrides: Record<string, ContentPatch<T>>,
): T[] {
  const result: T[] = [];
  const builtinIds = new Set<string>();

  for (const item of defaults) {
    builtinIds.add(item.id);
    const patch = overrides[item.id];
    if (patch?.deleted) continue;
    result.push(patch ? { ...item, ...fieldsOf(patch), id: item.id } : item);
  }

  for (const [id, patch] of Object.entries(overrides)) {
    if (patch?.added && !builtinIds.has(id)) {
      result.push({ ...fieldsOf(patch), id } as T);
    }
  }

  return result;
}

/**
 * `key` 与 `defaults` 都接受 ref / getter：家长端内容管理按模块切 Tab 时，
 * 模块会变。若只收普通值，setup 期求值一次后就永远绑定在首个模块上。
 */
export interface CollectionConfig<T extends ContentItemBase> {
  /** 覆盖项的命名空间，取模块 key */
  key: MaybeRefOrGetter<TileKey>;
  /** 内置默认条目 */
  defaults: MaybeRefOrGetter<T[]>;
}

/**
 * 通用内容集合：内置内容与家长覆盖项合并后的响应式列表。
 *
 * 合并语义（与多模块改造前的卡片逻辑一致）：
 * 1. 遍历内置条目，`deleted` 的跳过，有 patch 的浅合并；
 * 2. 追加 `added` 的自定义条目，id 与内置项冲突时以已合并的内置项为准（不重复）。
 */
export function useCollection<T extends ContentItemBase>(
  config: CollectionConfig<T>,
): {
  add: (draft: Omit<T, 'id'>) => void;
  items: ComputedRef<T[]>;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<T>) => void;
} {
  const kidStore = useKidStore();

  function readOverrides(): Record<string, ContentPatch<T>> {
    return (kidStore.contentOverrides[toValue(config.key)] ?? {}) as Record<
      string,
      ContentPatch<T>
    >;
  }

  function writeOverrides(): Record<string, ContentPatch<T>> {
    const key = toValue(config.key);
    kidStore.contentOverrides[key] ??= {};
    return kidStore.contentOverrides[key] as Record<string, ContentPatch<T>>;
  }

  const items = computed<T[]>(() =>
    mergeCollection(toValue(config.defaults), readOverrides()),
  );

  function add(draft: Omit<T, 'id'>) {
    // 与 store 里学习记录 id 的生成方式一致，避免同毫秒内连续新增时碰撞
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    writeOverrides()[id] = { ...draft, added: true } as ContentPatch<T>;
  }

  function update(id: string, patch: Partial<T>) {
    const overrides = writeOverrides();
    const base = toValue(config.defaults).find((d) => d.id === id);
    // 内置项也要保留已有覆盖项里 base 上没有的字段（版本间结构变动时不丢数据）
    overrides[id] = {
      ...base,
      ...fieldsOf(overrides[id] ?? {}),
      ...patch,
      added: !base,
    } as ContentPatch<T>;
  }

  function remove(id: string) {
    const overrides = writeOverrides();
    const base = toValue(config.defaults).find((d) => d.id === id);
    if (base) {
      overrides[id] = { deleted: true } as ContentPatch<T>;
      return;
    }
    // 自定义条目（无内置基座）直接从覆盖项里摘掉，不留空壳
    const { [id]: _removed, ...rest } = overrides;
    kidStore.contentOverrides[toValue(config.key)] = rest;
  }

  return { add, items, remove, update };
}
