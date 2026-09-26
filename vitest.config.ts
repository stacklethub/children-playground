import { fileURLToPath } from 'node:url';

import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [Vue(), VueJsx()],
  resolve: {
    alias: {
      // 各应用的 `#/` 源码别名（见 @vben/vite-config）
      '#': fileURLToPath(new URL('apps/web-antd/src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    // Node 22+ 自带的 localStorage 访问器会遮蔽 happy-dom 注入的全局，见该文件注释
    setupFiles: ['./vitest.setup.ts'],
    environmentOptions: {
      happyDOM: {
        settings: {
          // happy-dom v20+ disables JS evaluation by default (security fix).
          // Treat disabled script loading as success to preserve test behavior.
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/node_modules/**',
      '**/{stylelint,eslint}.config.*',
      '**/{oxfmt,oxlint}.config.*',
    ],
  },
});
