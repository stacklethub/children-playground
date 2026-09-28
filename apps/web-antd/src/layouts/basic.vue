<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useWatermark } from '@vben/hooks';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { $t, i18n } from '#/locales';
import { emojiAvatar } from '#/utils/avatar';
import { clearParentGate } from '#/utils/parent-gate';

const router = useRouter();
const userStore = useUserStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

/**
 * 无后端模式：家长中心用本地门禁替代账号登录。
 * 这里注入一个本地家长用户与静态菜单，让 vben 的 BasicLayout 正常渲染。
 * 菜单 name 直接存翻译后的文本（vben 菜单组件原样渲染 name），
 * 并在 locale 变化时重新注入，保证切换语言后菜单标题同步更新。
 */
function injectLocalUser() {
  userStore.setUserInfo({
    // 必须是可以当 <img src> 用的值：直接放 emoji 会加载失败，VbenAvatar 会退化
    // 成渲染 alt（= 昵称）的兜底文本，导致下拉面板里出现两个「家长」。见 utils/avatar.ts
    avatar: emojiAvatar('🧑'),
    homePath: '/parent/dashboard',
    realName: $t('parent.common.localParent'),
    roles: [],
    userId: 'local-parent',
    username: 'local-parent',
  });
}

function injectAccessMenus() {
  // 扁平菜单：家长端 5 个页面直接平铺在一级菜单里，不再套一层分组
  // （无子节点的顶层项会被渲染成可点击的 MenuItem，见 menu-ui/sub-menu.vue）
  accessStore.setAccessMenus([
    {
      icon: 'lucide:bar-chart-3',
      name: $t('parent.nav.dashboard'),
      path: '/parent/dashboard',
    },
    {
      icon: 'lucide:baby',
      name: $t('parent.nav.children'),
      path: '/parent/children',
    },
    {
      icon: 'lucide:images',
      name: $t('parent.nav.content'),
      path: '/parent/content',
    },
    {
      icon: 'lucide:calendar-check',
      name: $t('parent.nav.plan'),
      path: '/parent/plan',
    },
    {
      icon: 'lucide:settings',
      name: $t('parent.nav.settings'),
      path: '/parent/settings',
    },
  ]);
}

onMounted(() => {
  injectLocalUser();
  injectAccessMenus();
});

// 语言切换不刷新页面，菜单 name 是模块顶层一次性求值，需手动重新注入
watch(i18n.global.locale, () => {
  injectAccessMenus();
});

/** 无后端模式：退出家长中心 = 清除门禁标记 + 回到宝宝端首页 */
async function handleLogout() {
  clearParentGate();
  await router.replace('/kid/home');
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout
    :avatar
    :text="userStore.userInfo?.realName"
    @clear-preferences-and-logout="handleLogout"
    @logout="handleLogout"
  >
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :text="userStore.userInfo?.realName"
        @clear-preferences-and-logout="handleLogout"
        @logout="handleLogout"
      />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
