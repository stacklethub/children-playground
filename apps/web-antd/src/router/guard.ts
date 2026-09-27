import type { Router } from 'vue-router';

import { preferences } from '@vben/preferences';
import { startProgress, stopProgress } from '@vben/utils';

import { isParentGatePassed } from '#/utils/parent-gate';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 *
 * 无后端模式：没有账号登录。宝宝端（/kid）与家长端（/parent）都直接可访问，
 * 家长端额外用「家长门禁」（sessionStorage 标记）保护，避免孩子误入。
 * 这里的 accessToken / 动态路由生成逻辑已随登录一起移除。
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to) => {
    // 家长中心：未通过门禁时重定向到宝宝端首页（那里有家长入口）
    if (to.path.startsWith('/parent') && !isParentGatePassed()) {
      return { path: '/kid/home', replace: true };
    }
    return true;
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
