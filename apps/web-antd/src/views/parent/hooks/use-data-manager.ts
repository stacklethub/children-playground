import type { DataSnapshot } from '#/data/data-snapshot';

import { computed } from 'vue';

import { saveContentOverrides } from '#/data/content-repo';
import { emptySnapshot, normalizeSnapshot } from '#/data/data-snapshot';
import { buildCategories, buildQuestionBank } from '#/data/question-bank';
import { useDeviceStore, useFamilyStore, useKidStore } from '#/store';
import {
  getBinding,
  hasBinding,
  pickAndBind,
  saveAndBind,
  unbind,
  writeToBound,
} from '#/utils/local-file-sync';

/**
 * 家长端「数据管理」：导入 / 导出 / 绑定本地 JSON 文件。
 *
 * 无后端模式的数据契约：
 * - 题库（contentOverrides）持久化在 IndexedDB（见 data/content-repo.ts）；
 * - 导出：从 store + IndexedDB 收集数据打包成 JSON；
 * - 导入：JSON 解包，回填 store 并同步写 IndexedDB；
 * - 绑定：File System Access API 选一个 JSON 文件作为主副本，双向同步。
 */
export function useDataManager() {
  const familyStore = useFamilyStore();
  const deviceStore = useDeviceStore();
  const kidStore = useKidStore();

  /** 当前是否有绑定的文件（会话内） */
  const bound = computed(() => hasBinding());

  /** 收集当前数据为快照（题库覆盖项即 IndexedDB 主副本的内容） */
  function collect(): DataSnapshot {
    const overrides = kidStore.contentOverrides;
    return {
      version: emptySnapshot().version,
      exportedAt: Date.now(),
      contentOverrides: overrides,
      questions: buildQuestionBank(overrides),
      categories: buildCategories(),
      children: familyStore.children,
      records: kidStore.records,
      wrongBook: kidStore.wrongBook,
      moduleSettings: kidStore.moduleSettings,
      adventureProgress: kidStore.adventureProgress,
    };
  }

  /** 导出为 JSON 文件下载 */
  function exportJson() {
    const snapshot = collect();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `宝宝学堂数据-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** 把快照写回各 store（导入 / 绑定同步共用） */
  function apply(snapshot: DataSnapshot) {
    // normalizeSnapshot 已做结构校验，这里断言回具体的 store 类型
    kidStore.contentOverrides =
      snapshot.contentOverrides as typeof kidStore.contentOverrides;
    kidStore.moduleSettings =
      snapshot.moduleSettings as typeof kidStore.moduleSettings;
    kidStore.wrongBook = snapshot.wrongBook as typeof kidStore.wrongBook;
    kidStore.adventureProgress =
      snapshot.adventureProgress as typeof kidStore.adventureProgress;
    kidStore.records = snapshot.records as typeof kidStore.records;
    familyStore.children = snapshot.children as typeof familyStore.children;
    // 题库覆盖项同步落 IndexedDB（题库主副本）
    void saveContentOverrides(
      snapshot.contentOverrides as typeof kidStore.contentOverrides,
    );
    // 设备绑定关系：绑定的孩子若不在导入的孩子列表里，清除设备绑定
    const childIds = new Set(
      snapshot.children.map((c) => (c as { id: string }).id),
    );
    for (const known of deviceStore.knownChildren) {
      if (!childIds.has(known.id)) {
        deviceStore.forgetChild(known.id);
      }
    }
  }

  /** 从 JSON 文件导入（读文件内容，覆盖本机数据） */
  async function importJson(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;
    const snapshot = normalizeSnapshot(data);
    apply(snapshot);
  }

  /** 绑定本地 JSON 文件：读文件内容覆盖本机，之后保持同步 */
  async function bindFile(): Promise<void> {
    const data = await pickAndBind();
    const snapshot = normalizeSnapshot(data);
    apply(snapshot);
  }

  /** 另存为并绑定新文件 */
  async function saveAsBound(): Promise<void> {
    await saveAndBind(collect());
  }

  /** 把当前数据写回已绑定文件（手动同步） */
  async function syncToBound(): Promise<void> {
    await writeToBound(collect());
  }

  /** 解除绑定（保留本机数据） */
  async function unbindFile(): Promise<void> {
    await unbind();
  }

  /** 读取绑定文件名（展示用） */
  async function boundFileName(): Promise<string | undefined> {
    const binding = await getBinding();
    return binding?.fileName;
  }

  return {
    bindFile,
    bound,
    boundFileName,
    collect,
    exportJson,
    importJson,
    saveAsBound,
    syncToBound,
    unbindFile,
  };
}
