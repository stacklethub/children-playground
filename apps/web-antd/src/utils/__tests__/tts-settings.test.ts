import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
} from '#/utils/tts-settings';

const SETTINGS_KEY = 'child-study-tts-settings';
const LEGACY_KEY = 'child-study-tts-enabled';

/** happy-dom 不提供 localStorage，用内存版顶替 */
function stubLocalStorage(store: Map<string, string> = new Map()) {
  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  });
}

/** 写入抛错（配额满、隐私模式），读取照常可用的版本 */
function stubFailingWrites(store: Map<string, string>) {
  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
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

  it('默认走 azure，两条通道的音色均为空串（表示用该源默认音色）', () => {
    const settings = getTtsSettings();
    expect(settings.source).toBe('azure');
    expect(settings.voices.azure).toEqual({ 'en-US': '', 'zh-CN': '' });
    expect(settings.voices.system).toEqual({ 'en-US': '', 'zh-CN': '' });
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

  it('两条通道的音色各自可保存读回，互不覆盖', () => {
    saveTtsSettings({
      ...DEFAULT_SETTINGS,
      voices: {
        azure: { 'en-US': '', 'zh-CN': 'zh-CN-XiaoxiaoNeural' },
        system: {
          'en-US': '',
          'zh-CN': 'Microsoft Huihui - Chinese (Simplified, PRC)',
        },
      },
    });
    const settings = getTtsSettings();
    expect(settings.voices.azure['zh-CN']).toBe('zh-CN-XiaoxiaoNeural');
    expect(settings.voices.system['zh-CN']).toBe(
      'Microsoft Huihui - Chinese (Simplified, PRC)',
    );
  });

  it('各通道里的非字符串值被规范成空串', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        voices: {
          azure: { 'en-US': 42, 'zh-CN': 'zh-CN-XiaoxiaoNeural' },
          system: { 'en-US': 'Microsoft Ava', 'zh-CN': null },
        },
      }),
    );
    const settings = getTtsSettings();
    expect(settings.voices.azure).toEqual({
      'en-US': '',
      'zh-CN': 'zh-CN-XiaoxiaoNeural',
    });
    expect(settings.voices.system).toEqual({
      'en-US': 'Microsoft Ava',
      'zh-CN': '',
    });
  });

  it('旧版本的扁平 voices 结构被丢弃，回落成两条通道的默认音色', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ voices: { 'zh-CN': 'zh-CN-XiaoxiaoNeural' } }),
    );
    const settings = getTtsSettings();
    expect(settings.voices.azure['zh-CN']).toBe('');
    expect(settings.voices.system['zh-CN']).toBe('');
  });

  it('voices 是垃圾值时回落成两条通道的默认音色，不抛错', () => {
    for (const junk of ['不是对象', 42, [], { azure: 'zh-CN-XiaoxiaoNeural' }]) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ voices: junk }));
      expect(getTtsSettings().voices).toEqual(DEFAULT_SETTINGS.voices);
    }
  });

  it('首次读取时迁移旧开关并删除旧键', () => {
    localStorage.setItem(LEGACY_KEY, '0');
    const settings = getTtsSettings();
    expect(settings.enabled).toBe(false);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it('旧键为 1 时迁移出 enabled: true 并删除旧键', () => {
    localStorage.setItem(LEGACY_KEY, '1');
    const settings = getTtsSettings();
    expect(settings.enabled).toBe(true);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it('迁移时写入失败则保留旧键以便下次重试，且本次仍返回旧开关表达的值', () => {
    const store = new Map<string, string>([[LEGACY_KEY, '0']]);
    stubFailingWrites(store);

    expect(() => getTtsSettings()).not.toThrow();
    expect(getTtsSettings().enabled).toBe(false);
    // 旧键必须留着：删掉而新键又没写成的话，家长的「语音已关闭」偏好就永久丢了
    expect(localStorage.getItem(LEGACY_KEY)).toBe('0');
  });

  it('已有新配置时旧键也会被清理，且新配置的值不被旧开关覆盖', () => {
    saveTtsSettings({ ...DEFAULT_SETTINGS, enabled: true, rate: 1.3 });
    localStorage.setItem(LEGACY_KEY, '0');
    const settings = getTtsSettings();
    expect(settings.rate).toBe(1.3);
    expect(settings.enabled).toBe(true);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('保存成功时返回 true', () => {
    expect(saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 1.2 })).toBe(true);
  });

  it('写入失败时返回 false，且不抛错', () => {
    stubFailingWrites(new Map());
    expect(() => saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 1.2 })).not.toThrow();
    expect(saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 1.2 })).toBe(false);
  });

  it('写入失败后仍能读回之前的值，而不是默认值', () => {
    const store = new Map<string, string>();
    stubLocalStorage(store);
    saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 1.2 });

    stubFailingWrites(store);
    saveTtsSettings({ ...DEFAULT_SETTINGS, rate: 1.4 });

    expect(() => getTtsSettings()).not.toThrow();
    expect(getTtsSettings().rate).toBe(1.2);
  });
});
