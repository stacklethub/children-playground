import { defineEventHandler, readBody } from 'h3';

import { verifyBindToken } from '../../utils/bind-token';
import {
  loadChildrenMap,
  upsertRecords,
  type LearnRecord,
} from '../../utils/kid-store';
import {
  forbiddenResponse,
  useResponseError,
  useResponseSuccess,
} from '../../utils/response';

/**
 * 上报学习记录（宝宝端）
 * 鉴权：设备绑定令牌（家长在家长中心绑定孩子时签发），令牌授权范围必须与记录归属一致
 * 幂等：按记录 id 去重
 */
export default defineEventHandler(async (event) => {
  const bind = verifyBindToken(event);
  if (!bind) {
    return forbiddenResponse(event, 'invalid bind token');
  }

  const body = (await readBody(event)) as Partial<LearnRecord>;
  if (!body?.id || !body?.childId || !body?.module) {
    return useResponseError('invalid payload', 'invalid payload');
  }

  // 令牌只能写自己绑定的那个孩子的数据
  if (body.childId !== bind.childId || body.parentId !== bind.parentId) {
    return forbiddenResponse(event, 'bind token scope mismatch');
  }

  const children = await loadChildrenMap();
  const child = children[body.childId];
  if (!child || child.parentId !== bind.parentId) {
    return forbiddenResponse(event, 'child not found');
  }

  const added = await upsertRecords([body as LearnRecord]);
  return useResponseSuccess({ accepted: true, added });
});
