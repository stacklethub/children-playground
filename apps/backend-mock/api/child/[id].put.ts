import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { loadChildrenMap, saveChildrenMap } from '../../utils/kid-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '../../utils/response';
import { verifyAccessToken } from '../../utils/jwt-utils';

/** 编辑孩子档案（仅限本人名下的孩子） */
export default defineEventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  const id = getRouterParam(event, 'id') as string;
  const map = await loadChildrenMap();
  const child = map[id];
  if (!child || child.parentId !== user.username) {
    return forbiddenResponse(event, 'child not found');
  }

  const { avatar, birthday, name } = await readBody(event);
  map[id] = {
    ...child,
    avatar: avatar ?? child.avatar,
    birthday: birthday ?? child.birthday,
    name: name?.trim() || child.name,
  };
  await saveChildrenMap(map);
  return useResponseSuccess(map[id]);
});
