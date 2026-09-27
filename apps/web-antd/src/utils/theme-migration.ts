/**
 * 一次性主题迁移：把历史缓存里的暗色主题改回浅色。
 *
 * 为什么需要它？偏好设置是**缓存优先**的 —— `initPreferences` 的合并顺序是
 * `merge({}, 缓存, 初始默认值)`，缓存里的值会盖掉默认值。而我们这次改的恰恰是
 * 默认值（`preferences.ts` 的 `theme.mode: 'light'`），所以已经访问过的设备
 * 刷新后仍旧是暗色，用户会以为改动没生效。
 *
 * 而那份缓存里的 `dark` 并不是用户的选择 —— 它是 vben 模板的内置默认值
 * （`@vben/preferences/config.ts` 里 `theme.mode: 'dark'`）在首次启动时被
 * `saveToCache()` 自动写进去的。所以把它纠正回 `light` 是「修正默认值」，
 * 不算覆盖用户偏好。
 *
 * 只会执行一次（打 namespace 级标记）。此后用户在偏好设置里主动切成暗色，
 * 不会再被改回来。
 */

/** 迁移标记的后缀；带 namespace 前缀，与偏好缓存同生共死（版本号变更时一起重置） */
const MIGRATION_FLAG_SUFFIX = 'theme-light-migrated';

/** 偏好设置缓存的结构：StorageManager 会包一层 `{ expiry, value }` */
interface CachedPreferences {
  value?: {
    theme?: {
      mode?: string;
    };
  };
}

/** `preferences-theme` 只存了主题模式快照，同样包一层 */
interface CachedThemeMode {
  value?: string;
}

function readJson<T>(raw: null | string): null | T {
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function resolveDefaultStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    // Safari 隐私模式等场景下访问 localStorage 会直接抛错
    return undefined;
  }
}

/**
 * 把历史缓存中的暗色主题迁移为浅色。
 *
 * @param namespace 偏好设置的命名空间（`main.ts` 里拼出的 `${NAMESPACE}-${version}-${env}`），
 *                  缓存的真实 key 是 `${namespace}-preferences`。
 * @param storage 存储对象，默认 `window.localStorage`；便于测试注入。
 * @returns 是否真的改动了缓存（用于测试与排查）
 */
export function migrateLegacyDarkTheme(
  namespace: string,
  storage: Storage | undefined = resolveDefaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  const flagKey = `${namespace}-${MIGRATION_FLAG_SUFFIX}`;
  if (storage.getItem(flagKey) !== null) {
    return false;
  }

  try {
    storage.setItem(flagKey, '1');
  } catch {
    // 写不进去（配额满 / 隐私模式）：放弃迁移，但不能影响应用启动
    return false;
  }

  let migrated = false;

  const preferencesKey = `${namespace}-preferences`;
  const cached = readJson<CachedPreferences>(storage.getItem(preferencesKey));
  const theme = cached?.value?.theme;
  if (theme && theme.mode === 'dark') {
    theme.mode = 'light';
    storage.setItem(preferencesKey, JSON.stringify(cached));
    migrated = true;
  }

  // 首屏 loading 的防闪脚本读的是单独存的主题快照（见 vite inject-app-loading 插件），
  // 不同步改的话，迁移后第一次刷新仍会先闪一层暗色底再变浅色。
  const themeKey = `${namespace}-preferences-theme`;
  const cachedTheme = readJson<CachedThemeMode>(storage.getItem(themeKey));
  if (cachedTheme && cachedTheme.value === 'dark') {
    cachedTheme.value = 'light';
    storage.setItem(themeKey, JSON.stringify(cachedTheme));
    migrated = true;
  }

  return migrated;
}
