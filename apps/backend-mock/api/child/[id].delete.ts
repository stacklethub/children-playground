import { defineEventHandler, getRouterParam } from 'h3';

import {
  loadChildrenMap,
  loadRecordsMap,
  saveChildrenMap,
  saveRecordsMap,
} from '../../utils/kid-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '../../utils/response';
import { verifyAccessToken } from '../../utils/jwt-utils';

/** 删除孩子档案，同时清理其学习记录 */
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

  delete children[id];
  await saveChildrenMap(children);

  const records = await loadRecordsMap();
  for (const recordId of Object.keys(records)) {
    if (records[recordId]?.childId === id) {
      delete records[recordId];
    }
  }
  await saveRecordsMap(records);

  return useResponseSuccess({ deleted: true });
});
