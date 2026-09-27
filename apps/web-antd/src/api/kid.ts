/** 学习记录（归属某个孩子） */
export interface LearnRecordPayload {
  childId: string;
  createdAt: number;
  detail?: string;
  id: string;
  itemId: string;
  module: string;
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

// 无后端模式：学习记录、孩子档案、报告全部本地化（IndexedDB），
// 不再调用任何服务端接口。这里仅保留数据类型定义，供 store 与页面引用，
// 保持原有字段形状不变。
