/**
 * 幼儿学习平台 mock 数据层：家长账号下的孩子档案 + 按孩子归属的学习记录。
 * 使用 Nitro storage('data')，数据落盘到 .data/kv，跨 handler 共享。
 */

export interface ChildProfile {
  avatar: string;
  birthday?: string;
  createdAt: number;
  /** 孩子 id */
  id: string;
  /** 昵称 */
  name: string;
  /** 归属家长账号（username） */
  parentId: string;
}

export interface LearnRecord {
  /** 孩子 id */
  childId: string;
  createdAt: number;
  detail?: string;
  id: string;
  itemId: string;
  module: string;
  /** 归属家长账号 */
  parentId: string;
  result: string;
  /** 本次获得星星 */
  stars: number;
}

const CHILDREN_KEY = 'kid-children';
const RECORDS_KEY = 'kid-records';

export function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function loadChildrenMap() {
  const storage = useStorage<Record<string, ChildProfile>>('data');
  return (await storage.getItem(CHILDREN_KEY)) ?? {};
}

export async function saveChildrenMap(map: Record<string, ChildProfile>) {
  const storage = useStorage<Record<string, ChildProfile>>('data');
  await storage.setItem(CHILDREN_KEY, map);
}

export async function loadRecordsMap() {
  const storage = useStorage<Record<string, LearnRecord>>('data');
  return (await storage.getItem(RECORDS_KEY)) ?? {};
}

export async function saveRecordsMap(map: Record<string, LearnRecord>) {
  const storage = useStorage<Record<string, LearnRecord>>('data');
  await storage.setItem(RECORDS_KEY, map);
}

/** 当前家长的孩子列表（按创建时间） */
export async function listChildrenByParent(parentId: string) {
  const map = await loadChildrenMap();
  return Object.values(map)
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** 批量幂等写入学习记录，返回新增条数 */
export async function upsertRecords(records: LearnRecord[]) {
  const map = await loadRecordsMap();
  let added = 0;
  for (const record of records) {
    if (!record?.id || map[record.id]) continue;
    map[record.id] = record;
    added += 1;
  }
  await saveRecordsMap(map);
  return added;
}

/** 按家长 + 可选孩子聚合最近 N 天的记录 */
export async function queryRecords(options: {
  childId?: string;
  days: number;
  parentId: string;
}) {
  const { childId, days, parentId } = options;
  const map = await loadRecordsMap();
  const since = Date.now() - days * 86_400_000;
  return Object.values(map).filter(
    (r) =>
      r.parentId === parentId &&
      r.createdAt >= since &&
      (!childId || r.childId === childId),
  );
}
