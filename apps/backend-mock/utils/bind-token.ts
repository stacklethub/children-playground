import type { EventHandlerRequest, H3Event } from 'h3';

import type { ChildProfile } from './kid-store';

import { getHeader } from 'h3';
import jwt from 'jsonwebtoken';

// TODO: 生产环境改为环境变量注入
const BIND_TOKEN_SECRET = 'child_bind_token_secret';

export interface BindTokenPayload {
  childId: string;
  parentId: string;
  scope: 'kid-bind';
}

/**
 * 家长登录后把孩子绑定到设备，签发长期令牌供宝宝端上报记录
 */
export function generateBindToken(child: ChildProfile) {
  return jwt.sign(
    { childId: child.id, parentId: child.parentId, scope: 'kid-bind' },
    BIND_TOKEN_SECRET,
    { expiresIn: '365d' },
  );
}

/**
 * 校验宝宝端绑定令牌，返回其授权范围（孩子 + 家长），失败返回 null
 */
export function verifyBindToken(
  event: H3Event<EventHandlerRequest>,
): BindTokenPayload | null {
  const authHeader = getHeader(event, 'Authorization');
  if (!authHeader?.startsWith('Bearer')) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(
      token,
      BIND_TOKEN_SECRET,
    ) as unknown as BindTokenPayload;
    if (decoded.scope !== 'kid-bind' || !decoded.childId) return null;
    return decoded;
  } catch {
    return null;
  }
}
