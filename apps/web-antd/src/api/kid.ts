import { requestClient } from '#/api/request';

export interface LearnRecordPayload {
  childName: string;
  createdAt: number;
  detail?: string;
  itemId: string;
  module: string;
  recordId: string;
  result: string;
}

/**
 * 上报学习记录（幂等，mock 服务失败由调用方静默处理）
 */
export async function submitLearnRecordApi(data: LearnRecordPayload) {
  return requestClient.post('/record/learn', data);
}

/**
 * 今日学习计划
 */
export async function getTodayPlanApi() {
  return requestClient.get('/plan/today');
}

/**
 * 学习报告（服务端聚合，mock 阶段与本地数据互相印证）
 */
export async function getLearnReportApi(range: 'month' | 'week' = 'week') {
  return requestClient.get('/record/report', { params: { range } });
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
