/**
 * 本机绑定关系：记录「这台设备（浏览器）绑定过哪些孩子」。
 *
 * 无后端模式下没有上报令牌 —— 宝宝端的学习记录直接写本地（IndexedDB），
 * 无需向服务端补传。这里退化为一个 childId 集合，保留原 API 形状
 * （getBindToken / setBindToken / clearBindToken），让调用方改动最小：
 * - setBindToken：标记该孩子已在本机绑定；
 * - getBindToken：判断该孩子是否本机绑定过（有值即视为已绑定）；
 * - clearBindToken：解除绑定记录。
 */
const STORAGE_KEY = 'child-study-bind-tokens';

function readAll(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** 标记孩子已在本机绑定（不再签发令牌，值用固定占位） */
export function setBindToken(record: { childId: string }) {
  const map = readAll();
  map[record.childId] = 'local';
  writeAll(map);
}

/** 判断孩子是否本机绑定过（有记录即视为已绑定） */
export function getBindToken(childId?: string): string | undefined {
  if (!childId) return undefined;
  return readAll()[childId];
}

export function clearBindToken(childId?: string) {
  if (!childId) {
    writeAll({});
    return;
  }
  const { [childId]: _removed, ...rest } = readAll();
  writeAll(rest);
}
