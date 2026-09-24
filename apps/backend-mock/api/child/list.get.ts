import { defineEventHandler } from 'h3';

import { listChildrenByParent } from '../../utils/kid-store';
import { unAuthorizedResponse, useResponseSuccess } from '../../utils/response';
import { verifyAccessToken } from '../../utils/jwt-utils';

/** 当前家长账号下的孩子列表 */
export default defineEventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  const children = await listChildrenByParent(user.username);
  return useResponseSuccess(children);
});
