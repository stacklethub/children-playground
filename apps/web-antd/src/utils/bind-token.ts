/**
 * 设备绑定令牌：家长在家长中心把孩子「绑定」到本设备后签发，
 * 宝宝端凭该令牌上报学习记录（宝宝端无登录态）。
 * 与家长登录令牌完全隔离：即使家长退出登录，宝宝端仍可继续学习与补传。
 */
const STORAGE_KEY = 'child-study-bind-tokens';

interface BindTokenRecord {
  childId: string;
  parentId: string;
  token: string;
  updatedAt: number;
}

type BindTokenMap = Record<string, BindTokenRecord>;

function readAll(): BindTokenMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as BindTokenMap;
  } catch {
    return {};
  }
}

function writeAll(map: BindTokenMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function setBindToken(record: Omit<BindTokenRecord, 'updatedAt'>) {
  const map = readAll();
  map[record.childId] = { ...record, updatedAt: Date.now() };
  writeAll(map);
}

export function getBindToken(childId?: string): string | undefined {
  if (!childId) return undefined;
  return readAll()[childId]?.token;
}

export function clearBindToken(childId?: string) {
  const map = readAll();
  if (childId) {
    delete map[childId];
  } else {
    for (const key of Object.keys(map)) delete map[key];
  }
  writeAll(map);
}
