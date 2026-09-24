import { defineEventHandler, getQuery } from 'h3';

import { useResponseSuccess } from '../../utils/response';

interface KidCategory {
  color: string;
  emoji: string;
  id: string;
  name: string;
}

interface KidCard {
  categoryId: string;
  emoji: string;
  fact?: string;
  id: string;
  name: string;
  pinyin: string;
}

const categories: KidCategory[] = [
  { color: '#F97316', emoji: '🐘', id: 'animals', name: '动物世界' },
  { color: '#EF4444', emoji: '🍎', id: 'fruits', name: '好吃的水果' },
  { color: '#3B82F6', emoji: '🚗', id: 'vehicles', name: '交通工具' },
  { color: '#8B5CF6', emoji: '🧒', id: 'body', name: '我的身体' },
];

const cards: KidCard[] = [
  { categoryId: 'animals', emoji: '🐘', fact: '大象的鼻子长长的，会喷水哦', id: 'a1', name: '大象', pinyin: 'dà xiàng' },
  { categoryId: 'animals', emoji: '🐰', fact: '小兔子爱吃胡萝卜，蹦蹦跳跳', id: 'a2', name: '小兔子', pinyin: 'xiǎo tù zi' },
  { categoryId: 'animals', emoji: '🐼', fact: '熊猫最爱吃竹子', id: 'a3', name: '熊猫', pinyin: 'xióng māo' },
  { categoryId: 'fruits', emoji: '🍎', fact: '苹果红红的，脆脆甜甜', id: 'f1', name: '苹果', pinyin: 'píng guǒ' },
  { categoryId: 'fruits', emoji: '🍌', fact: '香蕉弯弯的像月亮', id: 'f2', name: '香蕉', pinyin: 'xiāng jiāo' },
  { categoryId: 'vehicles', emoji: '🚗', fact: '小汽车嘀嘀嘀', id: 'v1', name: '小汽车', pinyin: 'xiǎo qì chē' },
  { categoryId: 'vehicles', emoji: '✈️', fact: '飞机飞得高高的', id: 'v2', name: '飞机', pinyin: 'fēi jī' },
  { categoryId: 'body', emoji: '👀', fact: '眼睛用来看东西', id: 'b1', name: '眼睛', pinyin: 'yǎn jing' },
];

export default defineEventHandler((event) => {
  const { categoryId } = getQuery(event);
  const list = categoryId
    ? cards.filter((c) => c.categoryId === categoryId)
    : cards;
  return useResponseSuccess({ categories, items: list });
});
