import { requestClient } from '#/api/request';

export namespace ChildApi {
  /** 孩子档案 */
  export interface ChildProfile {
    avatar: string;
    birthday?: string;
    createdAt: number;
    id: string;
    name: string;
    /** 归属家长账号 */
    parentId: string;
  }

  export interface ChildDraft {
    avatar?: string;
    birthday?: string;
    name: string;
  }

  /** 孩子与设备的绑定结果 */
  export interface ChildBindResult {
    /** 宝宝端上报记录用的长期令牌 */
    bindToken: string;
    child: ChildProfile;
  }
}

/** 当前家长账号下的孩子列表 */
export async function getChildrenApi() {
  return requestClient.get<ChildApi.ChildProfile[]>('/child/list');
}

/** 新建孩子档案 */
export async function createChildApi(data: ChildApi.ChildDraft) {
  return requestClient.post<ChildApi.ChildProfile>('/child/create', data);
}

/** 编辑孩子档案 */
export async function updateChildApi(id: string, data: ChildApi.ChildDraft) {
  return requestClient.put<ChildApi.ChildProfile>(`/child/${id}`, data);
}

/** 删除孩子档案（连同其学习记录） */
export async function deleteChildApi(id: string) {
  return requestClient.delete(`/child/${id}`);
}

/**
 * 把孩子绑定到当前设备（签发宝宝端上报令牌，需家长登录态）
 */
export async function bindChildApi(id: string) {
  return requestClient.post<ChildApi.ChildBindResult>(`/child/${id}/bind`);
}
