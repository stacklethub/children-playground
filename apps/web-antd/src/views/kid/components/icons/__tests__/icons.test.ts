import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TILE_KEYS } from '#/data/modules';

/**
 * 用 `import.meta.dirname` 而非 `import.meta.url` 解析路径：happy-dom 会替换全局
 * `URL`，其实现不认 `file:` base，会把相对路径解析到 document origin 下的
 * `http://localhost:3000/...`，`fileURLToPath` 随即抛 scheme 错误。
 */
const read = (file: string) =>
  readFileSync(resolve(import.meta.dirname, `../${file}.vue`), 'utf8');

const ICON_BY_TILE = {
  adventure: 'spot-adventure',
  cards: 'spot-cards',
  letters: 'spot-letters',
  logic: 'spot-logic',
  numbers: 'spot-numbers',
  pinyin: 'spot-pinyin',
  poems: 'spot-poems',
  rewards: 'spot-rewards',
  songs: 'spot-songs',
} as const;

describe('模块图标', () => {
  it('9 个入口各有一个图标文件', () => {
    expect(Object.keys(ICON_BY_TILE).toSorted()).toEqual(
      [...TILE_KEYS].toSorted(),
    );
  });

  it('每个图标都用 100x100 视口，保证统一缩放', () => {
    for (const file of Object.values(ICON_BY_TILE)) {
      expect(read(file)).toContain('viewBox="0 0 100 100"');
    }
  });

  it('每个图标都用了暖棕描边而不是纯黑', () => {
    for (const file of Object.values(ICON_BY_TILE)) {
      expect(read(file)).not.toMatch(/#000|black/i);
    }
  });
});
