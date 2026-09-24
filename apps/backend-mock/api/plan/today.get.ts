import { defineEventHandler } from 'h3';

import { useResponseSuccess } from '../../utils/response';

/** 今日学习计划（mock：返回默认建议值，家长端可在前端调整） */
export default defineEventHandler(() =>
  useResponseSuccess({
    date: new Date().toISOString().slice(0, 10),
    items: [
      { module: 'cards', targetCount: 10 },
      { module: 'letters', targetCount: 6 },
      { module: 'numbers', targetCount: 6 },
      { module: 'songs', targetCount: 2 },
    ],
    screenLimitMin: 20,
  }),
);
