<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

import type { ModuleDef } from '#/data/modules';

import { MODULES, TILE_KEYS } from '#/data/modules';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import TileButton from '../components/tile-button.vue';
import { useCurrentChild } from '../hooks/use-current-child';

const router = useRouter();
const kidStore = useKidStore();
const { bound, childId, childName } = useCurrentChild();

/** 首页磁贴由模块注册表派生，新增模块无需改动本文件 */
const tiles = TILE_KEYS.map((key) => MODULES[key]);

function go(tile: ModuleDef) {
  speak($t(`kid.modules.${tile.key}`));
  router.push(tile.path);
}

onMounted(() => {
  if (bound.value) {
    speak($t('kid.tts.welcome', { name: childName.value }));
  }
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <div v-else class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <!-- 顶部问候 -->
    <div class="mb-8 flex flex-wrap items-center justify-center gap-4">
      <span class="text-5xl">🌈</span>
      <h1 class="text-4xl font-black text-slate-700">
        {{ $t('kid.home.greeting', { name: childName }) }}
      </h1>
      <span
        class="flex items-center gap-2 rounded-full bg-white/80 px-5 py-2 text-2xl font-bold text-amber-500 shadow"
      >
        ⭐ {{ kidStore.starsOf(childId) }}
      </span>
    </div>

    <p class="mb-6 text-2xl text-slate-500">{{ $t('kid.home.question') }}</p>

    <!-- 学习岛入口 -->
    <div class="grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
      <TileButton
        v-for="tile in tiles"
        :key="tile.path"
        :bg="tile.bg"
        :desc="$t(`kid.tiles.${tile.key}Desc`)"
        :emoji="tile.emoji"
        :label="$t(`kid.modules.${tile.key}`)"
        @tap="go(tile)"
      />
    </div>
  </div>
</template>
