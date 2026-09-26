import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
} from '#/utils/tts-settings';

const SETTINGS_KEY = 'child-study-tts-settings';
const LEGACY_KEY = 'child-study-tts-enabled';

/** happy-dom 不提供 localStorage，用内存版顶替 */
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  });
}

describe('tts-settings', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('没有存储时返回默认值', () => {
    expect(getTtsSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('默认走 azure，中文与英文音色均为空串（表示用该源默认音色）', () => {
    const settings = getTtsSettings();
    expect(settings.source).toBe('azure');
    expect(settings.voices['zh-CN']).toBe('');
    expect(settings.voices['en-US']).toBe('');
  });

  it('可保存并读回', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, pitch: 20, rate: 1.2, source: 'system' });
    const settings = getTtsSettings();
    expect(settings.source).toBe('system');
    expect(settings.rate).toBe(1.2);
    expect(settings.pitch).toBe(20);
  });

  it('语速被夹到 [0.5, 1.5]', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 9 });
    expect(getTtsSettings().rate).toBe(1.5);
    saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 0 });
    expect(getTtsSettings().rate).toBe(0.5);
  });

  it('音调被夹到 [-50, 50]', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, pitch: 999 });
    expect(getTtsSettings().pitch).toBe(50);
    saveTtsSettings({ ...DEFAULT_SETTINGS, pitch: -999 });
    expect(getTtsSettings().pitch).toBe(-50);
  });

  it('非法的 source 回落为 azure', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ source: 'google' }));
    expect(getTtsSettings().source).toBe('azure');
  });

  it('损坏的 JSON 不会抛错，回落默认值', () => {
    localStorage.setItem(SETTINGS_KEY, '{ 这不是合法 JSON');
    expect(() => getTtsSettings()).not.toThrow();
    expect(getTtsSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('voices 里的非字符串值被规范成空串', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ voices: { 'en-US': 42, 'zh-CN': 'zh-CN-XiaoxiaoNeural' } }),
    );
    const settings = getTtsSettings();
    expect(settings.voices['en-US']).toBe('');
    expect(settings.voices['zh-CN']).toBe('zh-CN-XiaoxiaoNeural');
  });

  it('首次读取时迁移旧开关并删除旧键', () => {
    localStorage.setItem(LEGACY_KEY, '0');
    const settings = getTtsSettings();
    expect(settings.enabled).toBe(false);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it('已有的新配置不会被旧开关覆盖', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, enabled: true, rate: 1.3 });
    localStorage.setItem(LEGACY_KEY, '0');
    const settings = getTtsSettings();
    expect(settings.rate).toBe(1.3);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });
});
