/**
 * 轻量 IndexedDB 封装：把题库 / 孩子 / 设置等结构化数据本地化。
 *
 * 无后端模式下的数据源：IndexedDB 承载「主副本」，家长可把它导出为 JSON 文件，
 * 或绑定一个本地 JSON 文件做双向同步（见 `utils/local-file-sync.ts`）。
 *
 * 接口刻意设计成 key-value + 命名空间，语义与 `localStorage` 对齐但支持：
 * - 更大容量（题库、学习记录都不受 localStorage 5MB 限制）
 * - 结构化读写（对象直接存取，无序列化负担）
 *
 * ⚠️ 所有方法都返回 Promise；IndexedDB 不可用时（如隐私模式）回退到内存 Map，
 * 保证应用不因存储不可用而崩溃（数据仅本次会话有效）。
 */

/* oxlint-disable unicorn/prefer-add-event-listener -- IDBRequest 惯用 onsuccess / onerror / onblocked 回调赋值；
   该规则只认得 onerror，照改会让同一个 Promise 里 onX 与 addEventListener 两种风格混搭。 */

const DB_NAME = 'child-study';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: null | Promise<IDBDatabase | null> = null;

/** 内存回退：IndexedDB 不可用时使用 */
const memoryFallback = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function storeOf(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** 读单个 key；不存在或不可用时返回 undefined */
export async function dbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return memoryFallback.get(key) as T | undefined;

  return new Promise<T | undefined>((resolve) => {
    const request = storeOf(db, 'readonly').get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => resolve(memoryFallback.get(key) as T | undefined);
  });
}

/** 写单个 key；IndexedDB 不可用时写内存 */
export async function dbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryFallback.set(key, value);
    return;
  }

  return new Promise<void>((resolve) => {
    const request = storeOf(db, 'readwrite').put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      memoryFallback.set(key, value);
      resolve();
    };
  });
}

/** 删除单个 key */
export async function dbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryFallback.delete(key);
    return;
  }

  return new Promise<void>((resolve) => {
    const request = storeOf(db, 'readwrite').delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

/** 读某前缀下的所有 key（用于导出全量数据） */
export async function dbKeys(prefix = ''): Promise<string[]> {
  const db = await openDb();
  if (!db) {
    return [...memoryFallback.keys()].filter((k) => k.startsWith(prefix));
  }

  return new Promise<string[]>((resolve) => {
    const request = storeOf(db, 'readonly').getAllKeys();
    request.onsuccess = () => {
      const keys = (request.result as string[]).filter((k) =>
        k.startsWith(prefix),
      );
      resolve(keys);
    };
    request.onerror = () => resolve([]);
  });
}

/** 读某前缀下所有 key-value（用于导出全量数据） */
export async function dbDump<T = unknown>(
  prefix = '',
): Promise<Record<string, T>> {
  const keys = await dbKeys(prefix);
  const result: Record<string, T> = {};
  for (const key of keys) {
    const value = await dbGet<T>(key);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** 清空某前缀下的所有 key（覆盖导入前先清理旧数据） */
export async function dbClear(prefix = ''): Promise<void> {
  const keys = await dbKeys(prefix);
  for (const key of keys) {
    await dbDelete(key);
  }
}
