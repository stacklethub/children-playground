import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:user-cog',
      // 无后端模式：家长中心不再走账号登录，改为家长门禁（见 router/guard.ts）
      ignoreAccess: true,
      order: 10,
      // 仅用于面包屑根节点（家长端菜单是一级扁平，不再有分组项）
      title: $t('parent.nav.center'),
    },
    name: 'Parent',
    path: '/parent',
    redirect: '/parent/dashboard',
    children: [
      {
        name: 'ParentDashboard',
        path: 'dashboard',
        component: () => import('#/views/parent/dashboard/index.vue'),
        meta: {
          icon: 'lucide:bar-chart-3',
          title: $t('parent.nav.dashboard'),
        },
      },
      {
        name: 'ParentChildren',
        path: 'children',
        component: () => import('#/views/parent/children/index.vue'),
        meta: {
          icon: 'lucide:baby',
          title: $t('parent.nav.children'),
        },
      },
      {
        name: 'ParentContent',
        path: 'content',
        component: () => import('#/views/parent/content/index.vue'),
        meta: {
          icon: 'lucide:images',
          title: $t('parent.nav.content'),
        },
      },
      {
        name: 'ParentPlan',
        path: 'plan',
        component: () => import('#/views/parent/plan/index.vue'),
        meta: {
          icon: 'lucide:calendar-check',
          title: $t('parent.nav.plan'),
        },
      },
      {
        name: 'ParentSettings',
        path: 'settings',
        component: () => import('#/views/parent/settings/index.vue'),
        meta: {
          icon: 'lucide:settings',
          title: $t('parent.nav.settings'),
        },
      },
    ],
  },
];

export default routes;
