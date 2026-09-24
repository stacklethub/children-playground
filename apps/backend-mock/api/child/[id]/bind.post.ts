import { defineEventHandler, getRouterParam } from 'h3';

import { generateBindToken } from '../../../utils/bind-token';
import { loadChildrenMap } from '../../../utils/kid-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '../../../utils/response';
import { verifyAccessToken } from '../../../utils/jwt-utils';

/**
 * 把孩子绑定到当前设备：签发宝宝端长期上报令牌（需家长登录态）
 */
export default defineEventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  const id = getRouterParam(event, 'id') as string;
  const children = await loadChildrenMap();
  const child = children[id];
  if (!child || child.parentId !== user.username) {
    return forbiddenResponse(event, 'child not found');
  }

  return useResponseSuccess({
    bindToken: generateBindToken(child),
    child,
  });
});
