import { defineEventHandler, getQuery } from 'h3';

import { queryRecords } from '../../utils/kid-store';
import { unAuthorizedResponse, useResponseSuccess } from '../../utils/response';
import { verifyAccessToken } from '../../utils/jwt-utils';

/**
 * 家长端学习报告：仅返回当前家长名下（可指定某个孩子）的记录
 */
export default defineEventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  const { childId, range = 'week' } = getQuery(event) as {
    childId?: string;
    range?: string;
  };
  const days = range === 'month' ? 30 : 7;

  const records = await queryRecords({
    childId,
    days,
    parentId: user.username,
  });

  const byDay: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  let stars = 0;
  for (const r of records) {
    const key = new Date(r.createdAt).toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + 1;
    byModule[r.module] = (byModule[r.module] ?? 0) + 1;
    stars += r.stars ?? 0;
  }

  return useResponseSuccess({
    byDay,
    byModule,
    range: days,
    records: records.sort((a, b) => b.createdAt - a.createdAt),
    stars,
    total: records.length,
  });
});
