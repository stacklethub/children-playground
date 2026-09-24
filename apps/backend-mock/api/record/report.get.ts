import type { EventHandlerRequest, H3Event } from 'h3';

import { defineEventHandler, getQuery } from 'h3';

import { useResponseSuccess } from '../../utils/response';

interface LearnRecordPayload {
  childName: string;
  createdAt: number;
  detail?: string;
  itemId: string;
  module: string;
  recordId: string;
  result: string;
}

const RECORDS_KEY = 'kid-learn-records';

/** 按天聚合学习记录（mock 服务端视角；前端另有本地记录兜底） */
export default defineEventHandler(async (event: H3Event<EventHandlerRequest>) => {
  const { range = 'week' } = getQuery(event);
  const days = range === 'month' ? 30 : 7;
  const since = Date.now() - days * 86_400_000;

  const storage = useStorage<Record<string, LearnRecordPayload>>('data');
  const records = (await storage.getItem(RECORDS_KEY)) ?? {};

  const byDay: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  let total = 0;
  for (const r of Object.values(records)) {
    if (r.createdAt < since) continue;
    total += 1;
    const key = new Date(r.createdAt).toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + 1;
    byModule[r.module] = (byModule[r.module] ?? 0) + 1;
  }

  return useResponseSuccess({ byDay, byModule, range: days, total });
});
