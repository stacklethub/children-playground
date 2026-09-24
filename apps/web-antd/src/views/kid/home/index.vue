<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

const router = useRouter();
const kidStore = useKidStore();

interface Tile {
  bg: string;
  desc: string;
  emoji: string;
  name: string;
  path: string;
}

const tiles: Tile[] = [
  { bg: 'bg-orange-400', desc: '认一认身边的事物', emoji: '🐘', name: '看图识物', path: '/kid/cards' },
  { bg: 'bg-sky-400', desc: '和字母做朋友', emoji: '🔤', name: '字母乐园', path: '/kid/letters' },
  { bg: 'bg-emerald-400', desc: '数一数有几个', emoji: '🔢', name: '数字小屋', path: '/kid/numbers' },
  { bg: 'bg-violet-400', desc: '听儿歌啦', emoji: '🎵', name: '儿歌点播', path: '/kid/songs' },
  { bg: 'bg-amber-400', desc: '看看我的奖励', emoji: '⭐', name: '我的星星', path: '/kid/rewards' },
];

function go(tile: Tile) {
  speak(tile.name);
  router.push(tile.path);
}

onMounted(() => {
  speak(`欢迎来到宝宝学堂，${kidStore.childName}！今天想玩什么呢？`);
});
</script>

<template>
  <div class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <!-- 顶部问候 -->
    <div class="mb-8 flex items-center gap-4">
      <span class="text-5xl">🌈</span>
      <h1 class="text-4xl font-black text-slate-700">
        你好，{{ kidStore.childName }}！
      </h1>
      <span
        class="flex items-center gap-2 rounded-full bg-white/80 px-5 py-2 text-2xl font-bold text-amber-500 shadow"
      >
        ⭐ {{ kidStore.stars }}
      </span>
    </div>

    <!-- 学习岛入口 -->
    <div class="grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
      <button
        v-for="tile in tiles"
        :key="tile.path"
        class="flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 active:scale-95"
        @click="go(tile)"
      >
        <span
          class="flex h-24 w-24 items-center justify-center rounded-full text-6xl"
          :class="tile.bg"
        >
          {{ tile.emoji }}
        </span>
        <span class="text-2xl font-bold text-slate-700">{{ tile.name }}</span>
        <span class="text-base text-slate-400">{{ tile.desc }}</span>
      </button>
    </div>
  </div>
</template>
