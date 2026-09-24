import type { EventHandlerRequest, H3Event } from 'h3';

import { defineEventHandler, readBody } from 'h3';

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

/** 幂等写入学习记录（useStorage 跨 handler 共享，data 驱动持久化到 .data/kv） */
export default defineEventHandler(async (event: H3Event<EventHandlerRequest>) => {
  const body = (await readBody(event)) as LearnRecordPayload;
  if (!body?.recordId || !body?.module) {
    return useResponseSuccess({ accepted: false, reason: 'invalid payload' });
  }
  const storage = useStorage<Record<string, LearnRecordPayload>>('data');
  const records = (await storage.getItem(RECORDS_KEY)) ?? {};
  if (!records[body.recordId]) {
    records[body.recordId] = body;
    await storage.setItem(RECORDS_KEY, records);
  }
  return useResponseSuccess({
    accepted: true,
    total: Object.keys(records).length,
  });
});
