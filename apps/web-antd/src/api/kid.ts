import { kidRequestClient, requestClient } from '#/api/request';

/** 学习记录（归属某个孩子） */
export interface LearnRecordPayload {
  childId: string;
  createdAt: number;
  detail?: string;
  id: string;
  itemId: string;
  module: string;
  parentId: string;
  result: string;
  stars: number;
}

export interface LearnReport {
  byDay: Record<string, number>;
  byModule: Record<string, number>;
  range: number;
  records: LearnRecordPayload[];
  stars: number;
  total: number;
}

/**
 * 上报单条学习记录（凭孩子绑定令牌，幂等；失败由调用方静默处理并留待补传）
 */
export async function submitLearnRecordApi(
  data: LearnRecordPayload,
  bindToken: string,
) {
  return kidRequestClient.post('/record/learn', data, {
    headers: { Authorization: `Bearer ${bindToken}` },
  });
}

/**
 * 批量补传离线期间的记录（凭孩子绑定令牌，幂等）
 */
export async function syncLearnRecordsApi(
  records: LearnRecordPayload[],
  bindToken: string,
) {
  return kidRequestClient.post<{ added: number; rejected?: number }>(
    '/record/sync',
    { records },
    { headers: { Authorization: `Bearer ${bindToken}` } },
  );
}

/**
 * 家长端学习报告（需登录，可按孩子过滤）
 */
export async function getLearnReportApi(params: {
  childId?: string;
  range?: 'month' | 'week';
}) {
  return requestClient.get<LearnReport>('/record/report', { params });
}

/**
 * 内容卡片（服务端内容源，预留）
 */
export async function getContentCardsApi(categoryId?: string) {
  return requestClient.get('/content/cards', { params: { categoryId } });
}

/**
 * 儿歌列表（服务端内容源，预留）
 */
export async function getContentSongsApi() {
  return requestClient.get('/content/songs');
}
