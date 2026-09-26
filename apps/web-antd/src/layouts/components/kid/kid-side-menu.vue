<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { isLearnModule, MODULES, TILE_KEYS } from '#/data/modules';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

const route = useRoute();
const router = useRouter();
const kidStore = useKidStore();

/** 与首页磁贴同一套派生规则：家长关掉的模块不进菜单 */
const items = computed(() =>
  TILE_KEYS.map((key) => MODULES[key]).filter(
    (def) => !isLearnModule(def.key) || kidStore.moduleEnabled(def.key),
  ),
);

/** 子路由（如看图识物的分类）也要让所属模块保持高亮 */
function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function go(path: string, label: string) {
  if (route.path === path) return;
  speak(label);
  router.push(path);
}

/** 标题栏回学习岛 */
function goHome() {
  if (route.name === 'KidHome') return;
  router.push({ name: 'KidHome' });
}
</script>

<template>
  <!-- 窄屏只留图标给内容区让位，宽屏再展开文字；底部留白避开左下角的家长入口 -->
  <nav
    class="flex h-full w-20 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/50 bg-white/40 px-2 pb-24 pt-4 backdrop-blur lg:w-56 lg:px-3"
  >
    <!-- 标题栏：点一下回学习岛 -->
    <button
      class="mb-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/50 active:scale-95 lg:px-3"
      @click="goHome"
    >
      <span class="text-4xl">🧸</span>
      <span class="hidden truncate text-xl font-black text-slate-700 lg:inline">
        {{ $t('kid.app.name') }}
      </span>
    </button>

    <button
      v-for="item in items"
      :key="item.path"
      class="flex items-center gap-3 rounded-2xl px-2 py-2 transition active:scale-95 lg:px-3"
      :class="isActive(item.path) ? 'bg-white shadow-md' : 'hover:bg-white/60'"
      @click="go(item.path, $t(`kid.modules.${item.key}`))"
    >
      <span class="text-3xl">{{ item.emoji }}</span>
      <span class="hidden truncate text-xl font-bold text-slate-600 lg:inline">
        {{ $t(`kid.modules.${item.key}`) }}
      </span>
    </button>
  </nav>
</template>
