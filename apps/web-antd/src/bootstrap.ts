import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { registerLoadingDirective } from '@vben/common-ui/es/loading';
import { preferences } from '@vben/preferences';
import { initStores } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antd';

import { useTitle } from '@vueuse/core';

import { $t, setupI18n } from '#/locales';
import { useFamilyStore } from '#/store';

import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm } from './adapter/form';
import App from './app.vue';
import { router } from './router';

// 儿童端字体：霞鹜文楷（SIL OFL 1.1，中文 UI 与汉字内容）+ Baloo 2（同 OFL，西文与数字）。
// 两个包都按 unicode-range 分片，浏览器只下载页面实际用到的字块 ——
// 因此家长新增内容也不会出现缺字豆腐块。
//
// ⚠️ 必须排在 @vben/styles 之前：样式包的 reset 会覆盖 font-family。
//
// 三处容易踩的细节：
// 1. 霞鹜文楷**走构建期子集化的产物**（`assets/fonts/lxgw-subset.css`），
//    不再直接引上游包的 `lxgwwenkaiscreen.css`。原因：上游按 unicode-range 切成
//    97 个分片共 4.87MB，多文件构建下浏览器按需加载没问题，但 `build:singlefile`
//    会把**全部**分片 base64 内联进单 HTML —— 字体一项就占 6.5MB，是整个产物的 60%。
//    子集化后按项目实际用字裁剪，降到约 1.2MB。
//    重新生成：`pnpm run subset:font`（内容改了会自动重建，见 scripts/build-subset-fonts.mjs）。
//    这里取全量版而非上游的 GB 版：古诗里有大量 GB2312 常用集之外的汉字，GB 版会出豆腐块。
// 2. Baloo 2 的字重范围是 **400–800，没有 900**。引 700 与 800 两档；
//    样式里写 font-black(900) 时，浏览器会取最近的 800。
// 3. 两个包的字族名分别是 'LXGW WenKai Screen' 与 'Baloo 2'，见 layouts/kid.vue 的回退栈。
//    回退栈里还有系统中文字体：子集外的生僻字会回退到它，不会显示豆腐块。
import './assets/fonts/lxgw-subset.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';

async function bootstrap(namespace: string) {
  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupVbenForm();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 1020,
  // });

  const app = createApp(App);

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 首次运行（本机从未有过孩子档案）：系统预置一个默认孩子并绑定到本机，
  // 让宝宝端首页开箱即可学习，无需先进家长中心手动新建。
  // 只在首次执行一次（defaultSeeded 持久化）；此后家长可在家长中心改名 / 头像 /
  // 增删孩子 / 改绑或解绑本机学习者，系统不会再自动干预。
  useFamilyStore().ensureDefaultChild();

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };
