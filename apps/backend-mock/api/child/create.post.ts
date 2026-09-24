import { defineEventHandler, readBody, setResponseStatus } from 'h3';

import {
  genId,
  loadChildrenMap,
  saveChildrenMap,
  type ChildProfile,
} from '../../utils/kid-store';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '../../utils/response';
import { verifyAccessToken } from '../../utils/jwt-utils';

/** 新建孩子档案 */
export default defineEventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  const { avatar = '🧒', birthday, name } = await readBody(event);
  if (!name?.trim()) {
    setResponseStatus(event, 400);
    return useResponseError('BadRequestException', 'child name is required');
  }

  const map = await loadChildrenMap();
  const child: ChildProfile = {
    avatar,
    birthday,
    createdAt: Date.now(),
    id: genId('child'),
    name: name.trim(),
    parentId: user.username,
  };
  map[child.id] = child;
  await saveChildrenMap(map);
  return useResponseSuccess(child);
});
