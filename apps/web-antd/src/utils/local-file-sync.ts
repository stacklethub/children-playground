/**
 * 本地文件绑定：用 File System Access API 选一个 JSON 文件作为「主副本」，
 * 与 IndexedDB 双向同步。
 *
 * 浏览器无法静默读写任意路径文件，这里用 `showOpenFilePicker` / `showSaveFilePicker`
 * 拿到文件句柄（FileSystemFileHandle），之后即可在用户已授权的前提下读写该文件。
 *
 * 兼容性：File System Access API 仅在 Chromium 系（Chrome / Edge）支持。
 * 不支持的浏览器下，`pickAndBind()` 会抛错，由调用方降级为「纯导入 / 导出」。
 */

import { dbGet, dbSet } from './local-db';

/** File System Access API 的类型补充（TS lib 默认未包含） */
declare global {
  interface FileSystemFileHandle {
    readonly name: string;
    createWritable(): Promise<{
      close(): Promise<void>;
      write(data: string): Promise<void>;
    }>;
    getFile(): Promise<File>;
  }

  interface Window {
    showOpenFilePicker?(options: {
      multiple?: boolean;
      types?: {
        accept: Record<string, string[]>;
        description?: string;
      }[];
    }): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(options: {
      suggestedName?: string;
      types?: {
        accept: Record<string, string[]>;
        description?: string;
      }[];
    }): Promise<FileSystemFileHandle>;
  }
}

/** 绑定关系记录：数据库 key → 文件句柄不可序列化，只能存名字做展示 */
const BIND_KEY = '__file_binding__';

export interface FileBinding {
  /** 绑定的文件名（仅展示用，真正的句柄保存在内存中） */
  fileName: string;
  /** 上次同步时间 */
  syncedAt: number;
}

/** 内存中的文件句柄（页面刷新后需要用户重新选文件） */
let activeHandle: FileSystemFileHandle | null = null;

/** 支持 File System Access API 的 window：两个选择器都已收窄为非空 */
type PickerWindow = Window & {
  showOpenFilePicker: NonNullable<Window['showOpenFilePicker']>;
  showSaveFilePicker: NonNullable<Window['showSaveFilePicker']>;
};

/** 取可用的文件选择器 API；浏览器不支持时返回 null，由调用方降级 */
function pickerApi(): null | PickerWindow {
  if (typeof window === 'undefined') return null;
  if (!window.showOpenFilePicker || !window.showSaveFilePicker) return null;
  return window as PickerWindow;
}

/** 选一个已有 JSON 文件并绑定（读文件内容返回，供调用方决定是否覆盖） */
export async function pickAndBind(): Promise<unknown> {
  const api = pickerApi();
  if (!api) {
    throw new Error('File System Access API not supported');
  }
  const [handle] = await api.showOpenFilePicker({
    types: [
      {
        description: 'JSON 数据文件',
        accept: { 'application/json': ['.json'] },
      },
    ],
    multiple: false,
  });
  if (!handle) throw new Error('no file selected');
  activeHandle = handle;

  const file = await handle.getFile();
  const text = await file.text();
  const data = JSON.parse(text) as unknown;

  await dbSet(BIND_KEY, {
    fileName: handle.name,
    syncedAt: Date.now(),
  } satisfies FileBinding);

  return data;
}

/** 新建 / 另存为 JSON 文件并绑定 */
export async function saveAndBind(data: unknown): Promise<void> {
  const api = pickerApi();
  if (!api) {
    throw new Error('File System Access API not supported');
  }
  const handle = await api.showSaveFilePicker({
    suggestedName: '幼儿学堂数据.json',
    types: [
      {
        description: 'JSON 数据文件',
        accept: { 'application/json': ['.json'] },
      },
    ],
  });
  activeHandle = handle;

  await writeToHandle(handle, data);
  await dbSet(BIND_KEY, {
    fileName: handle.name,
    syncedAt: Date.now(),
  } satisfies FileBinding);
}

async function writeToHandle(handle: FileSystemFileHandle, data: unknown) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/** 把数据写回当前绑定的文件（保持同步）；未绑定则抛错 */
export async function writeToBound(data: unknown): Promise<void> {
  if (!activeHandle) throw new Error('no bound file');
  await writeToHandle(activeHandle, data);
  await dbSet(BIND_KEY, {
    fileName: activeHandle.name,
    syncedAt: Date.now(),
  } satisfies FileBinding);
}

/** 当前是否已绑定文件（本次会话内） */
export function hasBinding(): boolean {
  return activeHandle !== null;
}

/** 读取绑定元信息（仅展示用） */
export async function getBinding(): Promise<FileBinding | undefined> {
  return dbGet<FileBinding>(BIND_KEY);
}

/** 解除绑定（保留 IndexedDB 数据，仅断开文件句柄） */
export async function unbind(): Promise<void> {
  activeHandle = null;
}
