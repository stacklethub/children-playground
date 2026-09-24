import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import { MOCK_USERS } from '~/utils/mock-data';
import { setRefreshTokenCookie } from '~/utils/cookie-utils';
import {
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

/**
 * 家长账号注册（mock：进程内 MOCK_USERS，重启后重置）
 * 新账号默认 homePath 指向家长中心
 */
export default defineEventHandler(async (event) => {
  const { password, realName, username } = await readBody(event);
  if (!username || !password) {
    setResponseStatus(event, 400);
    return useResponseError('用户名和密码不能为空', 'username/password required');
  }
  if (MOCK_USERS.some((u) => u.username === username)) {
    setResponseStatus(event, 409);
    return useResponseError('该账号已存在', 'username exists');
  }

  const user = {
    homePath: '/parent/dashboard',
    id: MOCK_USERS.length,
    password,
    realName: realName || username,
    roles: ['parent'],
    username,
  };
  MOCK_USERS.push(user);

  const accessToken = generateAccessToken(user);
  setRefreshTokenCookie(event, generateRefreshToken(user));

  const { password: _pwd, ...userinfo } = user;
  return useResponseSuccess({ ...userinfo, accessToken });
});
