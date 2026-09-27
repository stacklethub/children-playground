/**
 * 家长门禁状态：无后端模式下，家长中心用「成人验证门禁」替代账号登录。
 *
 * 通过门禁后，用 sessionStorage 记录「本次会话已通过」，路由守卫据此放行
 * `/parent` 路由。会话结束（关闭标签页）自动失效，下次进入需重新验证，
 * 避免孩子误入家长区。
 */
const GATE_KEY = 'child-study-parent-gate';

export function isParentGatePassed(): boolean {
  try {
    return sessionStorage.getItem(GATE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markParentGatePassed() {
  try {
    sessionStorage.setItem(GATE_KEY, '1');
  } catch {
    // 隐私模式下 sessionStorage 不可用，忽略
  }
}

export function clearParentGate() {
  try {
    sessionStorage.removeItem(GATE_KEY);
  } catch {
    // 忽略
  }
}
