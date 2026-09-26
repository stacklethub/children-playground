import type { ComputedRef } from 'vue';

import type { TileKey } from './modules';

import { computed } from 'vue';

import { useKidStore } from '#/store';

export interface ContentItemBase {
  id: string;
}

/** 家长中心对单个条目的覆盖：改字段 / 新增标记 / 删除标记 */
export type ContentPatch<T> = Partial<T> & {
  added?: boolean;
  deleted?: boolean;
};

export interface CollectionConfig<T extends ContentItemBase> {
  /** 覆盖项的命名空间，取模块 key */
  key: TileKey;
  /** 内置默认条目 */
  defaults: T[];
}

/**
 * 通用内容集合：内置内容与家长覆盖项合并后的响应式列表。
 *
 * 合并语义（与多模块改造前的卡片逻辑一致）：
 * 1. 遍历内置条目，`deleted` 的跳过，有 patch 的浅合并；
 * 2. 追加 `added` 的自定义条目，id 与内置项冲突时以已合并的内置项为准（不重复）。
 */
export function useCollection<T extends ContentItemBase>(config: CollectionConfig<T>): {
  add: (draft: Omit<T, 'id'>) => void;
  items: ComputedRef<T[]>;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<T>) => void;
} {
  const kidStore = useKidStore();

  function readOverrides(): Record<string, ContentPatch<T>> {
    return (kidStore.contentOverrides[config.key] ?? {}) as Record<
      string,
      ContentPatch<T>
    >;
  }

  function writeOverrides(): Record<string, ContentPatch<T>> {
    kidStore.contentOverrides[config.key] ??= {};
    return kidStore.contentOverrides[config.key] as Record<
      string,
      ContentPatch<T>
    >;
  }

  /** 覆盖项里 added / deleted 是集合自身的标记，不是内容字段，合并前必须剥掉 */
  function fieldsOf(patch: ContentPatch<T>): Partial<T> {
    const { added: _added, deleted: _deleted, ...fields } = patch;
    return fields;
  }

  const items = computed<T[]>(() => {
    const overrides = readOverrides();
    const result: T[] = [];
    const builtinIds = new Set<string>();

    for (const item of config.defaults) {
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
  });

  function add(draft: Omit<T, 'id'>) {
    // 与 store 里学习记录 id 的生成方式一致，避免同毫秒内连续新增时碰撞
    const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    writeOverrides()[id] = { ...draft, added: true } as ContentPatch<T>;
  }

  function update(id: string, patch: Partial<T>) {
    const overrides = writeOverrides();
    const base = config.defaults.find((d) => d.id === id);
    overrides[id] = {
      ...(base ?? overrides[id] ?? {}),
      ...patch,
      added: !base,
    } as ContentPatch<T>;
  }

  function remove(id: string) {
    const overrides = writeOverrides();
    const base = config.defaults.find((d) => d.id === id);
    if (base) {
      overrides[id] = { deleted: true } as ContentPatch<T>;
    } else {
      delete overrides[id];
    }
  }

  return { add, items, remove, update };
}
