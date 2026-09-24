import { defineEventHandler } from 'h3';

import { useResponseSuccess } from '../../utils/response';

const songs = [
  {
    emoji: '🐯',
    id: 's1',
    lines: ['两只老虎，两只老虎，', '跑得快，跑得快，', '一只没有眼睛，', '一只没有尾巴，', '真奇怪！真奇怪！'],
    title: '两只老虎',
  },
  {
    emoji: '⭐',
    id: 's2',
    lines: ['一闪一闪亮晶晶，', '满天都是小星星，', '挂在天上放光明，', '好像许多小眼睛。'],
    title: '小星星',
  },
  {
    emoji: '🥕',
    id: 's3',
    lines: ['拔萝卜，拔萝卜，', '嘿哟嘿哟，拔萝卜，', '老太婆，快快来，', '快来帮我们拔萝卜。'],
    title: '拔萝卜',
  },
];

export default defineEventHandler(() => useResponseSuccess(songs));
