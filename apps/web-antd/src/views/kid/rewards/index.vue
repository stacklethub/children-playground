<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { $t } from '#/locales';
import { MODULE_KEYS, MODULES, useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';

const kidStore = useKidStore();
const { bound, childId, childName } = useCurrentChild();
const { rewardBadges, rewardShow, rewardText } = useReward();

const stars = computed(() => kidStore.starsOf(childId.value));
const streak = computed(() => kidStore.streakOf(childId.value));
const todayCounts = computed(() => kidStore.todayCountsOf(childId.value));
const badges = computed(() => kidStore.badgesOf(childId.value));

const tasks = computed(() =>
  MODULE_KEYS.map((module) => {
    const count = todayCounts.value[module] ?? 0;
    const goal = kidStore.goalOf(module);
    return {
      count,
      done: count >= goal,
      emoji: MODULES[module].emoji,
      goal,
      module,
    };
  }),
);

const allDone = computed(() => tasks.value.every((t) => t.done));

onMounted(() => {
  if (!bound.value) return;
  speak(
    allDone.value
      ? $t('kid.tts.rewardsAllDone', {
          name: childName.value,
          stars: stars.value,
        })
      : $t('kid.tts.rewardsProgress', { stars: stars.value }),
  );
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="⭐" title-key="kid.modules.rewards">
    <!-- 星星总数 -->
    <div class="mb-8 flex flex-col items-center">
      <span class="text-[7rem] leading-none">⭐</span>
      <span class="text-6xl font-black text-amber-500">{{ stars }}</span>
      <span class="mt-1 text-xl text-slate-500">
        {{ $t('kid.rewards.streak', { days: streak }) }} 🎯
      </span>
    </div>

    <!-- 今日任务 -->
    <h2 class="mb-4 text-3xl font-bold text-slate-700">
      {{ $t('kid.rewards.tasks') }}
    </h2>
    <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
      <div
        v-for="task in tasks"
        :key="task.module"
        class="flex flex-col items-center gap-1 rounded-3xl bg-white/95 p-5 shadow-md"
        :class="task.done ? 'ring-4 ring-emerald-300' : ''"
      >
        <span class="text-4xl">{{ task.emoji }}</span>
        <span class="text-xl font-bold text-slate-600">
          {{ $t(`kid.modules.${task.module}`) }}
        </span>
        <span
          class="text-lg font-bold"
          :class="task.done ? 'text-emerald-500' : 'text-amber-500'"
        >
          {{
            task.done
              ? `✓ ${$t('kid.rewards.done')}`
              : $t('kid.rewards.progress', {
                  count: task.count,
                  goal: task.goal,
                })
          }}
        </span>
      </div>
    </div>

    <!-- 徽章墙 -->
    <h2 class="mb-4 mt-10 text-3xl font-bold text-slate-700">
      {{ $t('kid.rewards.badges') }}
    </h2>
    <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
      <div
        v-for="badge in badges"
        :key="badge.id"
        class="flex items-center gap-4 rounded-3xl p-5 shadow-md transition"
        :class="
          badge.earned
            ? 'bg-amber-50 ring-2 ring-amber-300'
            : 'bg-white/50 opacity-60'
        "
      >
        <span class="text-5xl" :class="badge.earned ? '' : 'grayscale'">
          {{ badge.emoji }}
        </span>
        <div>
          <p class="text-xl font-bold text-slate-700">
            {{ $t(`kid.badges.${badge.key}.name`) }}
          </p>
          <p class="text-sm text-slate-400">
            {{ $t(`kid.badges.${badge.key}.desc`) }}
          </p>
        </div>
      </div>
    </div>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
