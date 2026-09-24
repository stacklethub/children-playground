import { defineEventHandler, readBody } from 'h3';

import { verifyBindToken } from '../../utils/bind-token';
import {
  loadChildrenMap,
  upsertRecords,
  type LearnRecord,
} from '../../utils/kid-store';
import { useResponseSuccess } from '../../utils/response';

/**
 * 批量补传宝宝端离线期间产生的记录（幂等）
 * 鉴权同单条上报：绑定令牌授权范围内的记录才会被接受，其余计入 rejected
 */
export default defineEventHandler(async (event) => {
  const bind = verifyBindToken(event);
  if (!bind) {
    return useResponseSuccess({ added: 0, rejected: 0 });
  }

  const { records = [] } = (await readBody(event)) as {
    records?: LearnRecord[];
  };
  if (!Array.isArray(records) || records.length === 0) {
    return useResponseSuccess({ added: 0, rejected: 0 });
  }

  const children = await loadChildrenMap();
  const valid = records.filter((record) => {
    if (!record?.id || record.childId !== bind.childId) return false;
    if (record.parentId !== bind.parentId) return false;
    const child = children[record.childId];
    return Boolean(child && child.parentId === bind.parentId);
  });

  const added = await upsertRecords(valid);
  return useResponseSuccess({
    added,
    rejected: records.length - valid.length,
  });
});
