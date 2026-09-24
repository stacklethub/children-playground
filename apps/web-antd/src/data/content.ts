/**
 * 宝宝端学习内容数据（内置离线内容，图片使用 emoji，避免素材版权与加载问题）。
 * 家长中心的内容管理会生成 overrides 合并到这些数据上。
 *
 * ⚠️ 内容层是中文单语，不参与 i18n：
 * 卡片名称 / 拼音 / 小知识、字母释义、数字汉字、儿歌歌词都保持中文，
 * 不随界面语言切换（i18n 只覆盖界面框架文案）。朗读这些内容时固定使用
 * 中文语音，见 utils/tts.ts 的 CONTENT_TTS_LANG。
 */

export interface KidCategory {
  color: string;
  emoji: string;
  id: string;
  name: string;
}

export interface KidCard {
  categoryId: string;
  emoji: string;
  fact?: string;
  id: string;
  name: string;
  pinyin: string;
}

export interface KidLetter {
  emoji: string;
  example: string;
  letter: string;
  word: string;
  zh: string;
}

export interface KidSong {
  emoji: string;
  id: string;
  lines: string[];
  title: string;
}

export interface KidNumber {
  count: number;
  emoji: string;
  num: number;
  word: string;
}

export const kidCategories: KidCategory[] = [
  { color: '#F97316', emoji: '🐘', id: 'animals', name: '动物世界' },
  { color: '#EF4444', emoji: '🍎', id: 'fruits', name: '好吃的水果' },
  { color: '#3B82F6', emoji: '🚗', id: 'vehicles', name: '交通工具' },
  { color: '#8B5CF6', emoji: '🧒', id: 'body', name: '我的身体' },
];

export const kidCards: KidCard[] = [
  // 动物
  {
    categoryId: 'animals',
    emoji: '🐘',
    fact: '大象的鼻子长长的，会喷水哦',
    id: 'a1',
    name: '大象',
    pinyin: 'dà xiàng',
  },
  {
    categoryId: 'animals',
    emoji: '🐰',
    fact: '小兔子爱吃胡萝卜，蹦蹦跳跳',
    id: 'a2',
    name: '小兔子',
    pinyin: 'xiǎo tù zi',
  },
  {
    categoryId: 'animals',
    emoji: '🦁',
    fact: '狮子的吼声可响亮啦',
    id: 'a3',
    name: '狮子',
    pinyin: 'shī zi',
  },
  {
    categoryId: 'animals',
    emoji: '🐼',
    fact: '熊猫最爱吃竹子',
    id: 'a4',
    name: '熊猫',
    pinyin: 'xióng māo',
  },
  {
    categoryId: 'animals',
    emoji: '🐶',
    fact: '小狗会汪汪叫，是人类的好朋友',
    id: 'a5',
    name: '小狗',
    pinyin: 'xiǎo gǒu',
  },
  {
    categoryId: 'animals',
    emoji: '🐱',
    fact: '小猫咪走路静悄悄',
    id: 'a6',
    name: '小猫',
    pinyin: 'xiǎo māo',
  },
  {
    categoryId: 'animals',
    emoji: '🐦',
    fact: '小鸟会在天上飞',
    id: 'a7',
    name: '小鸟',
    pinyin: 'xiǎo niǎo',
  },
  {
    categoryId: 'animals',
    emoji: '🐟',
    fact: '小鱼在水里游来游去',
    id: 'a8',
    name: '小鱼',
    pinyin: 'xiǎo yú',
  },
  // 水果
  {
    categoryId: 'fruits',
    emoji: '🍎',
    fact: '苹果红红的，脆脆甜甜',
    id: 'f1',
    name: '苹果',
    pinyin: 'píng guǒ',
  },
  {
    categoryId: 'fruits',
    emoji: '🍌',
    fact: '香蕉弯弯的像月亮',
    id: 'f2',
    name: '香蕉',
    pinyin: 'xiāng jiāo',
  },
  {
    categoryId: 'fruits',
    emoji: '🍇',
    fact: '葡萄一串一串的，紫紫的',
    id: 'f3',
    name: '葡萄',
    pinyin: 'pú táo',
  },
  {
    categoryId: 'fruits',
    emoji: '🍉',
    fact: '西瓜外面绿绿的，里面红红的',
    id: 'f4',
    name: '西瓜',
    pinyin: 'xī guā',
  },
  {
    categoryId: 'fruits',
    emoji: '🍊',
    fact: '橙子酸酸甜甜，有很多维生素C',
    id: 'f5',
    name: '橙子',
    pinyin: 'chéng zi',
  },
  {
    categoryId: 'fruits',
    emoji: '🍓',
    fact: '草莓身上有好多小点点',
    id: 'f6',
    name: '草莓',
    pinyin: 'cǎo méi',
  },
  // 交通工具
  {
    categoryId: 'vehicles',
    emoji: '🚗',
    fact: '小汽车嘀嘀嘀，开在路上跑得快',
    id: 'v1',
    name: '小汽车',
    pinyin: 'xiǎo qì chē',
  },
  {
    categoryId: 'vehicles',
    emoji: '🚌',
    fact: '公交车大大的，能坐好多好多人',
    id: 'v2',
    name: '公交车',
    pinyin: 'gōng jiāo chē',
  },
  {
    categoryId: 'vehicles',
    emoji: '🚒',
    fact: '消防车是红色的，救火的时候出动',
    id: 'v3',
    name: '消防车',
    pinyin: 'xiāo fáng chē',
  },
  {
    categoryId: 'vehicles',
    emoji: '✈️',
    fact: '飞机飞得高高的，穿过云朵',
    id: 'v4',
    name: '飞机',
    pinyin: 'fēi jī',
  },
  {
    categoryId: 'vehicles',
    emoji: '🚂',
    fact: '火车呜呜叫，在铁轨上跑',
    id: 'v5',
    name: '火车',
    pinyin: 'huǒ chē',
  },
  {
    categoryId: 'vehicles',
    emoji: '🚲',
    fact: '骑自行车要戴好安全头盔',
    id: 'v6',
    name: '自行车',
    pinyin: 'zì xíng chē',
  },
  // 身体
  {
    categoryId: 'body',
    emoji: '👀',
    fact: '眼睛用来看东西，要保护视力',
    id: 'b1',
    name: '眼睛',
    pinyin: 'yǎn jing',
  },
  {
    categoryId: 'body',
    emoji: '👂',
    fact: '耳朵用来听声音',
    id: 'b2',
    name: '耳朵',
    pinyin: 'ěr duo',
  },
  {
    categoryId: 'body',
    emoji: '👃',
    fact: '鼻子用来闻味道、呼吸',
    id: 'b3',
    name: '鼻子',
    pinyin: 'bí zi',
  },
  {
    categoryId: 'body',
    emoji: '👄',
    fact: '嘴巴用来说话和吃饭',
    id: 'b4',
    name: '嘴巴',
    pinyin: 'zuǐ ba',
  },
  {
    categoryId: 'body',
    emoji: '🖐️',
    fact: '小手能做很多事情，勤洗手',
    id: 'b5',
    name: '小手',
    pinyin: 'xiǎo shǒu',
  },
  {
    categoryId: 'body',
    emoji: '🦶',
    fact: '小脚丫用来走路和跑步',
    id: 'b6',
    name: '小脚',
    pinyin: 'xiǎo jiǎo',
  },
];

export const kidLetters: KidLetter[] = [
  { emoji: '🍎', example: '🍎', letter: 'A', word: 'apple', zh: '苹果' },
  { emoji: '🐼', example: '🐼', letter: 'B', word: 'bear', zh: '熊' },
  { emoji: '🐱', example: '🐱', letter: 'C', word: 'cat', zh: '猫' },
  { emoji: '🐶', example: '🐶', letter: 'D', word: 'dog', zh: '狗' },
  { emoji: '🥚', example: '🥚', letter: 'E', word: 'egg', zh: '鸡蛋' },
  { emoji: '🐟', example: '🐟', letter: 'F', word: 'fish', zh: '鱼' },
  { emoji: '👧', example: '👧', letter: 'G', word: 'girl', zh: '女孩' },
  { emoji: '🏠', example: '🏠', letter: 'H', word: 'house', zh: '房子' },
  { emoji: '🍦', example: '🍦', letter: 'I', word: 'ice cream', zh: '冰淇淋' },
  { emoji: '🧃', example: '🧃', letter: 'J', word: 'juice', zh: '果汁' },
  { emoji: '🪁', example: '🪁', letter: 'K', word: 'kite', zh: '风筝' },
  { emoji: '🦁', example: '🦁', letter: 'L', word: 'lion', zh: '狮子' },
  { emoji: '🌙', example: '🌙', letter: 'M', word: 'moon', zh: '月亮' },
  { emoji: '🪹', example: '🐦', letter: 'N', word: 'nest', zh: '鸟窝' },
  { emoji: '🐄', example: '🐄', letter: 'O', word: 'ox', zh: '牛' },
  { emoji: '🐷', example: '🐷', letter: 'P', word: 'pig', zh: '猪' },
  { emoji: '👑', example: '👑', letter: 'Q', word: 'queen', zh: '女王' },
  { emoji: '🌈', example: '🌈', letter: 'R', word: 'rainbow', zh: '彩虹' },
  { emoji: '☀️', example: '☀️', letter: 'S', word: 'sun', zh: '太阳' },
  { emoji: '🌳', example: '🌳', letter: 'T', word: 'tree', zh: '树' },
  { emoji: '☂️', example: '☂️', letter: 'U', word: 'umbrella', zh: '雨伞' },
  { emoji: '🎻', example: '🎻', letter: 'V', word: 'violin', zh: '小提琴' },
  { emoji: '💧', example: '💧', letter: 'W', word: 'water', zh: '水' },
  { emoji: '📦', example: '📦', letter: 'X', word: 'box', zh: '盒子' },
  { emoji: '🟡', example: '🟡', letter: 'Y', word: 'yellow', zh: '黄色' },
  { emoji: '🦓', example: '🦓', letter: 'Z', word: 'zebra', zh: '斑马' },
];

export const kidNumbers: KidNumber[] = [
  { count: 1, emoji: '🍎', num: 1, word: '一' },
  { count: 2, emoji: '🐰', num: 2, word: '二' },
  { count: 3, emoji: '🎈', num: 3, word: '三' },
  { count: 4, emoji: '⭐', num: 4, word: '四' },
  { count: 5, emoji: '🐟', num: 5, word: '五' },
  { count: 6, emoji: '🍓', num: 6, word: '六' },
  { count: 7, emoji: '🌸', num: 7, word: '七' },
  { count: 8, emoji: '🍇', num: 8, word: '八' },
  { count: 9, emoji: '🚗', num: 9, word: '九' },
  { count: 10, emoji: '🦋', num: 10, word: '十' },
];

export const kidSongs: KidSong[] = [
  {
    emoji: '🐯',
    id: 's1',
    lines: [
      '两只老虎，两只老虎，',
      '跑得快，跑得快，',
      '一只没有眼睛，',
      '一只没有尾巴，',
      '真奇怪！真奇怪！',
    ],
    title: '两只老虎',
  },
  {
    emoji: '⭐',
    id: 's2',
    lines: [
      '一闪一闪亮晶晶，',
      '满天都是小星星，',
      '挂在天上放光明，',
      '好像许多小眼睛。',
      '一闪一闪亮晶晶，',
      '满天都是小星星。',
    ],
    title: '小星星',
  },
  {
    emoji: '🥕',
    id: 's3',
    lines: [
      '拔萝卜，拔萝卜，',
      '嘿哟嘿哟，拔萝卜，',
      '嘿哟嘿哟，拔不动，',
      '老太婆，快快来，',
      '快来帮我们拔萝卜。',
    ],
    title: '拔萝卜',
  },
  {
    emoji: '🤝',
    id: 's4',
    lines: [
      '找呀找呀找朋友，',
      '找到一个好朋友，',
      '敬个礼呀握握手，',
      '你是我的好朋友。',
    ],
    title: '找朋友',
  },
  {
    emoji: '🦆',
    id: 's5',
    lines: ['门前大桥下，', '游过一群鸭，', '快来快来数一数，', '二四六七八。'],
    title: '数鸭子',
  },
];
