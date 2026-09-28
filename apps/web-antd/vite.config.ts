import type { PluginOption } from 'vite';

import { env } from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(async () => {
  const scriptName = env.npm_lifecycle_event;
  const isSingle = scriptName === 'build:singlefile';
  const plugins: PluginOption[] = [];
  if (isSingle) {
    plugins.push(
      viteSingleFile({
        useRecommendedBuildConfig: false,
        removeViteModuleLoader: true,
      }),
    );
  }

  return {
    application: {
      nitroMock: false,
      archiver: !isSingle,
      compress: false,
      extraAppConfig: !isSingle,
      pwa: !isSingle,
    },
    vite: {
      plugins,
      build: {
        // 框架默认 es2015，会把大量 `?.` / `??` / async 语法降级成 helper，
        // 单文件产物里这部分是纯开销。es2019 覆盖 Safari 13+ / Chrome 73+
        // （2019 年机型），对幼儿学习场景的老旧家长手机仍然安全。
        target: 'es2019',
        ...(isSingle
          ? {
              assetsInlineLimit: Number.MAX_SAFE_INTEGER,
              cssCodeSplit: false,
              rolldownOptions: {
                output: {
                  codeSplitting: false,
                },
              },
            }
          : {}),
      },
      ...(isSingle ? { base: './' } : {}),
    },
  };
});
