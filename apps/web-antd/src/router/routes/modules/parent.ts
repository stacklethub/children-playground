import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:user-cog',
      order: 10,
      title: '家长中心',
    },
    name: 'Parent',
    path: '/parent',
    children: [
      {
        name: 'ParentDashboard',
        path: 'dashboard',
        component: () => import('#/views/parent/dashboard/index.vue'),
        meta: {
          icon: 'lucide:bar-chart-3',
          title: '学习报告',
        },
      },
      {
        name: 'ParentContent',
        path: 'content',
        component: () => import('#/views/parent/content/index.vue'),
        meta: {
          icon: 'lucide:images',
          title: '内容管理',
        },
      },
      {
        name: 'ParentPlan',
        path: 'plan',
        component: () => import('#/views/parent/plan/index.vue'),
        meta: {
          icon: 'lucide:calendar-check',
          title: '学习计划',
        },
      },
      {
        name: 'ParentSettings',
        path: 'settings',
        component: () => import('#/views/parent/settings/index.vue'),
        meta: {
          icon: 'lucide:settings',
          title: '通用设置',
        },
      },
    ],
  },
];

export default routes;
