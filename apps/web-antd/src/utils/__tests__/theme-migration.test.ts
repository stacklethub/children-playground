import { beforeEach, describe, expect, it } from 'vitest';

import { migrateLegacyDarkTheme } from '../theme-migration';

/**
 * 这组测试守的是「默认主题改成浅色」这件事在**已访问过的设备**上也真的生效。
 *
 * 背景：偏好设置是缓存优先的（`initPreferences` 里缓存盖默认值），而历史缓存里的
 * `dark` 是 vben 模板默认值自动写进去的、不是用户的选择。迁移必须：
 * - 把 dark 纠正为 light（否则用户以为改动没生效）；
 * - 不动 light / auto（用户自己的选择要保留）；
 * - 只跑一次（此后用户主动切暗色不能被改回来）。
 */
const NS = 'child-study-0.0.0-test';
const PREFS_KEY = `${NS}-preferences`;
const THEME_KEY = `${NS}-preferences-theme`;
const FLAG_KEY = `${NS}-theme-light-migrated`;

function seedPreferences(mode: string) {
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ expiry: undefined, value: { theme: { mode } } }),
  );
}

function seedThemeSnapshot(mode: string) {
  localStorage.setItem(
    THEME_KEY,
    JSON.stringify({ expiry: undefined, value: mode }),
  );
}

function readPreferencesMode(): string | undefined {
  const raw = localStorage.getItem(PREFS_KEY);
  if (!raw) return undefined;
  return JSON.parse(raw).value.theme.mode as string;
}

function readThemeSnapshot(): string | undefined {
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) return undefined;
  return JSON.parse(raw).value as string;
}

describe('migrateLegacyDarkTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('把历史缓存里的 dark 改成 light，并返回 true', () => {
    seedPreferences('dark');
    seedThemeSnapshot('dark');

    expect(migrateLegacyDarkTheme(NS)).toBe(true);
    expect(readPreferencesMode()).toBe('light');
    expect(readThemeSnapshot()).toBe('light');
  });

  it('同步首屏 loading 的主题快照，避免迁移后首次刷新闪暗色', () => {
    seedPreferences('dark');
    seedThemeSnapshot('dark');

    migrateLegacyDarkTheme(NS);

    // inject-app-loading 的防闪脚本读的就是这个 key
    expect(localStorage.getItem(THEME_KEY)).toContain('light');
  });

  it('只执行一次：打过标记后即使缓存又被置为 dark 也不改动', () => {
    seedPreferences('dark');
    expect(migrateLegacyDarkTheme(NS)).toBe(true);

    // 用户手动切回暗色
    seedPreferences('dark');
    seedThemeSnapshot('dark');

    expect(migrateLegacyDarkTheme(NS)).toBe(false);
    expect(readPreferencesMode()).toBe('dark');
    expect(readThemeSnapshot()).toBe('dark');
  });

  it('用户已选择的 light 不受影响', () => {
    seedPreferences('light');
    seedThemeSnapshot('light');

    expect(migrateLegacyDarkTheme(NS)).toBe(false);
    expect(readPreferencesMode()).toBe('light');
  });

  it('auto（跟随系统）不是模板默认值，保持不动', () => {
    seedPreferences('auto');
    seedThemeSnapshot('auto');

    expect(migrateLegacyDarkTheme(NS)).toBe(false);
    expect(readPreferencesMode()).toBe('auto');
    expect(readThemeSnapshot()).toBe('auto');
  });

  it('完全没有缓存（首次访问）时不报错，交给默认值 light 生效', () => {
    expect(migrateLegacyDarkTheme(NS)).toBe(false);
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
    // 标记仍会写下，避免每次启动都白跑一遍
    expect(localStorage.getItem(FLAG_KEY)).toBe('1');
  });

  it('缓存内容损坏时不抛错，也不破坏其它数据', () => {
    localStorage.setItem(PREFS_KEY, '{ 这不是合法 JSON');
    localStorage.setItem(THEME_KEY, 'null');

    expect(migrateLegacyDarkTheme(NS)).toBe(false);
    expect(localStorage.getItem(PREFS_KEY)).toBe('{ 这不是合法 JSON');
  });

  it('存储不可用（隐私模式）时安全返回 false', () => {
    expect(migrateLegacyDarkTheme(NS, undefined)).toBe(false);
  });

  it('只影响自己的 namespace，不碰其它 namespace 的缓存', () => {
    const otherKey = 'other-app-preferences';
    localStorage.setItem(
      otherKey,
      JSON.stringify({ value: { theme: { mode: 'dark' } } }),
    );

    migrateLegacyDarkTheme(NS);

    expect(localStorage.getItem(otherKey)).toContain('dark');
  });
});
