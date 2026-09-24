<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { BADGES, useKidStore, type LearnModule } from '#/store';
import { speak } from '#/utils/tts';

import StarToast from '../components/star-toast.vue';
import { useReward } from '../hooks/use-reward';

const kidStore = useKidStore();
const { rewardShow, rewardText, rewardBadges } = useReward();

const MODULE_META: Record<LearnModule, { emoji: string; name: string; path: string }> = {
  cards: { emoji: '🐘', name: '看图识物', path: '/kid/cards' },
  letters: { emoji: '🔤', name: '字母乐园', path: '/kid/letters' },
  numbers: { emoji: '🔢', name: '数字小屋', path: '/kid/numbers' },
  songs: { emoji: '🎵', name: '儿歌点播', path: '/kid/songs' },
};

const badges = computed(() =>
  BADGES.map((b) => ({
    ...b,
    earned: kidStore.earnedBadges.includes(b.id),
  })),
);

const tasks = computed(() =>
  (Object.keys(MODULE_META) as LearnModule[]).map((module) => ({
    count: kidStore.todayCounts[module] ?? 0,
    done: (kidStore.todayCounts[module] ?? 0) >= kidStore.dailyGoals[module]!,
    goal: kidStore.dailyGoals[module]!,
    ...MODULE_META[module],
  })),
);

const allDone = computed(() => tasks.value.every((t) => t.done));

onMounted(() => {
  speak(
    allDone.value
      ? `哇，今天的任务全部完成啦！${kidStore.childName}已经拥有${kidStore.stars}颗星星！`
      : `你现在有${kidStore.stars}颗星星，继续加油哦！`,
  );
});
</script>

<template>
  <div class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <!-- 星星总数 -->
    <div class="mb-8 flex flex-col items-center">
      <span class="text-[7rem] leading-none">⭐</span>
      <span class="text-6xl font-black text-amber-500">{{ kidStore.stars }}</span>
      <span class="mt-1 text-xl text-slate-500">
        连续学习 {{ kidStore.streakDays }} 天 🎯
      </span>
    </div>

    <!-- 今日任务 -->
    <h2 class="mb-4 text-3xl font-bold text-slate-700">今日任务</h2>
    <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
      <div
        v-for="task in tasks"
        :key="task.path"
        class="flex flex-col items-center gap-1 rounded-3xl bg-white/95 p-5 shadow-md"
        :class="task.done ? 'ring-4 ring-emerald-300' : ''"
      >
        <span class="text-4xl">{{ task.emoji }}</span>
        <span class="text-xl font-bold text-slate-600">{{ task.name }}</span>
        <span
          class="text-lg font-bold"
          :class="task.done ? 'text-emerald-500' : 'text-amber-500'"
        >
          {{ task.done ? '✓ 完成' : `${task.count}/${task.goal}` }}
        </span>
      </div>
    </div>

    <!-- 徽章墙 -->
    <h2 class="mb-4 mt-10 text-3xl font-bold text-slate-700">我的徽章</h2>
    <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
      <div
        v-for="badge in badges"
        :key="badge.id"
        class="flex items-center gap-4 rounded-3xl p-5 shadow-md transition"
        :class="badge.earned ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-white/50 opacity-60'"
      >
        <span class="text-5xl" :class="badge.earned ? '' : 'grayscale'">
          {{ badge.emoji }}
        </span>
        <div>
          <p class="text-xl font-bold text-slate-700">{{ badge.name }}</p>
          <p class="text-sm text-slate-400">{{ badge.desc }}</p>
        </div>
      </div>
    </div>

    <StarToast :show="rewardShow" :text="rewardText" :badges="rewardBadges" />
  </div>
</template>
