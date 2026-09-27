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
      ...(isSingle
        ? {
            base: './',
            build: {
              assetsInlineLimit: Number.MAX_SAFE_INTEGER,
              cssCodeSplit: false,
              rolldownOptions: {
                output: {
                  codeSplitting: false,
                },
              },
            },
          }
        : {}),
    },
  };
});
