import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
/** 宝宝端布局：全屏、无菜单，带回家按钮与家长门禁 */
const KidLayout = () => import('#/layouts/kid.vue');
/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: '/kid/home',
    children: [],
  },
  /**
   * 宝宝端路由：作为核心路由注册，无需登录即可游玩
   */
  {
    component: KidLayout,
    meta: {
      hideInBreadcrumb: true,
      hideInTab: true,
      title: $t('kid.app.name'),
    },
    name: 'Kid',
    path: '/kid',
    redirect: '/kid/home',
    children: [
      {
        component: () => import('#/views/kid/home/index.vue'),
        meta: { title: $t('kid.modules.home') },
        name: 'KidHome',
        path: 'home',
      },
      {
        component: () => import('#/views/kid/cards/index.vue'),
        meta: { title: $t('kid.modules.cards') },
        name: 'KidCards',
        path: 'cards/:categoryId?',
      },
      {
        component: () => import('#/views/kid/letters/index.vue'),
        meta: { title: $t('kid.modules.letters') },
        name: 'KidLetters',
        path: 'letters',
      },
      {
        component: () => import('#/views/kid/pinyin/index.vue'),
        meta: { title: $t('kid.modules.pinyin') },
        name: 'KidPinyin',
        path: 'pinyin',
      },
      {
        component: () => import('#/views/kid/poems/index.vue'),
        meta: { title: $t('kid.modules.poems') },
        name: 'KidPoems',
        path: 'poems',
      },
      {
        component: () => import('#/views/kid/logic/index.vue'),
        meta: { title: $t('kid.modules.logic') },
        name: 'KidLogic',
        path: 'logic',
      },
      {
        component: () => import('#/views/kid/adventure/index.vue'),
        meta: { title: $t('kid.modules.adventure') },
        name: 'KidAdventure',
        path: 'adventure',
      },
      {
        component: () => import('#/views/kid/numbers/index.vue'),
        meta: { title: $t('kid.modules.numbers') },
        name: 'KidNumbers',
        path: 'numbers',
      },
      {
        component: () => import('#/views/kid/songs/index.vue'),
        meta: { title: $t('kid.modules.songs') },
        name: 'KidSongs',
        path: 'songs/:songId?',
      },
      {
        component: () => import('#/views/kid/rewards/index.vue'),
        meta: { title: $t('kid.modules.rewards') },
        name: 'KidRewards',
        path: 'rewards',
      },
    ],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'Login',
        path: 'login',
        component: () => import('#/views/_core/authentication/login.vue'),
        meta: {
          title: $t('page.auth.login'),
        },
      },
      {
        name: 'CodeLogin',
        path: 'code-login',
        component: () => import('#/views/_core/authentication/code-login.vue'),
        meta: {
          title: $t('page.auth.codeLogin'),
        },
      },
      {
        name: 'QrCodeLogin',
        path: 'qrcode-login',
        component: () =>
          import('#/views/_core/authentication/qrcode-login.vue'),
        meta: {
          title: $t('page.auth.qrcodeLogin'),
        },
      },
      {
        name: 'ForgetPassword',
        path: 'forget-password',
        component: () =>
          import('#/views/_core/authentication/forget-password.vue'),
        meta: {
          title: $t('page.auth.forgetPassword'),
        },
      },
      {
        name: 'Register',
        path: 'register',
        component: () => import('#/views/_core/authentication/register.vue'),
        meta: {
          title: $t('page.auth.register'),
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
