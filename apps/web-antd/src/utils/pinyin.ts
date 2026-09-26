import cnchar from 'cnchar';

/**
 * 汉字转带声调的小写拼音，逐字用空格分开（「苹果」→「píng guǒ」）。
 *
 * 逐字转而不是整词：cnchar 多字的结果不带分隔（「zhuōzǐ」），
 * 而卡片上要按字对齐展示。轻声（如「爸爸」的第二个字）会按原调输出，
 * 对幼儿认读的影响可以忽略。
 */
export function pinyinOf(word: string): string {
  return [...word]
    .map((char) => `${cnchar.spell(char, 'tone', 'low')}`)
    .join(' ');
}

/**
 * 汉语拼音字形的呼读音。
 *
 * 拼音是拉丁字母，直接交给中文 TTS 会读成英文字母音（「b」→ /biː/）；
 * 而读例字又会把答案一起念出来。念这些同音汉字才是不泄露答案的正确发音。
 */
const SPELL_SOUND: Record<string, string> = {
  // 声母
  b: '玻',
  c: '雌',
  ch: '吃',
  d: '得',
  f: '佛',
  g: '哥',
  h: '喝',
  j: '基',
  k: '科',
  l: '勒',
  m: '摸',
  n: '讷',
  p: '坡',
  q: '欺',
  r: '日',
  s: '思',
  sh: '诗',
  t: '特',
  // y/w 是隔音字母，呼读音就是 i/u 本身
  w: '乌',
  x: '希',
  y: '衣',
  z: '资',
  zh: '知',
  // 韵母
  a: '啊',
  ai: '哀',
  an: '安',
  ang: '昂',
  ao: '熬',
  e: '鹅',
  ei: '诶',
  en: '恩',
  eng: '鞥',
  er: '儿',
  i: '衣',
  ie: '耶',
  in: '因',
  ing: '英',
  iu: '优',
  o: '喔',
  ong: '翁',
  ou: '欧',
  u: '乌',
  ui: '威',
  un: '温',
  ü: '迂',
  üe: '约',
  ün: '晕',
};

/** 拼音字形的呼读音汉字；未收录的返回 undefined，由调用方兜底 */
export function spellSoundOf(pinyin: string): string | undefined {
  return SPELL_SOUND[pinyin.toLowerCase()];
}
