<script setup lang="ts">
import type { KidLevel } from '#/data/content';
import type { LearnModule } from '#/store';

import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { MODULE_KEYS, useKidStore } from '#/store';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useArithmeticPractice, useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'adventure';
/** 每关的心数：扣光即失败，可立刻重来 */
const HEARTS = 3;

const { bound, childId } = useCurrentChild();
const { levels, logicItems } = useContent();
const kidStore = useKidStore();
const { guide, rewardBadges, rewardShow, rewardText } = useReward();
const { createQuiz: createArith } = useArithmeticPractice();

const active = ref<KidLevel>();
const hearts = ref(HEARTS);
const solved = ref(0);
const failed = ref(false);
const done = ref(false);
/** 当前题的出处：题干、错题本条目标识、所属模块（用于错题本归组） */
const meta = ref({ id: '', module: MODULE as LearnModule, prompt: '' });

const clearedIds = computed(() =>
  childId.value ? (kidStore.adventureProgress[childId.value] ?? []) : [],
);

/** 顺序解锁：第一关常开，之后需要通关前一关 */
function unlockedAt(index: number) {
  if (index === 0) return true;
  const previous = levels.value[index - 1];
  return Boolean(previous && clearedIds.value.includes(previous.id));
}

function isCleared(id: string) {
  return clearedIds.value.includes(id);
}

/** 从关卡声明的考察模块里抽一题；模块 key 非法时静默跳过 */
function buildQuestion(level: KidLevel) {
  const sources = level.modules.filter((key) =>
    (MODULE_KEYS as readonly string[]).includes(key),
  );
  const source = sources[Math.floor(Math.random() * sources.length)];
  if (!source) return { answer: '', options: [] as string[] };

  if (source === 'numbers') {
    const created = createArith();
    meta.value = {
      id: `adv-${created.expr}`,
      module: 'numbers',
      prompt: created.expr,
    };
    return {
      answer: `${created.answer}`,
      options: created.options.map(String),
    };
  }

  const pool = logicItems.value;
  const item = pool[Math.floor(Math.random() * pool.length)];
  if (!item) return { answer: '', options: [] as string[] };
  meta.value = { id: item.id, module: 'logic', prompt: item.prompt };
  return { answer: item.answer, options: [...item.options] };
}

const { next, pick, quiz } = useQuiz<string>({
  ask: () => {
    // 通关/失败后再出题不放音，避免盖过结算语音
    if (done.value || failed.value) return;
    speak(meta.value.prompt, { lang: CONTENT_TTS_LANG });
  },
  create: () => {
    const level = active.value;
    // next() 只在 enter() 里调用，此处 active 必已赋值；判空仅为类型收窄
    if (!level) return { answer: '', options: [] as string[] };
    return buildQuestion(level);
  },
  itemIdOf: () => meta.value.id,
  module: () => meta.value.module,
  onCorrect: () => {
    solved.value += 1;
    const level = active.value;
    if (!level || solved.value < level.questionCount) return;
    done.value = true;
    if (childId.value) kidStore.clearLevel(childId.value, level.id);
    speak($t('kid.tts.adventureWin'));
  },
  onWrong: () => {
    hearts.value -= 1;
    if (hearts.value <= 0) failed.value = true;
  },
  stars: 1,
});

/** 进入一关：重置本关心数、进度与结算状态 */
function enter(level: KidLevel) {
  active.value = level;
  hearts.value = HEARTS;
  solved.value = 0;
  failed.value = false;
  done.value = false;
  next();
}

function retry() {
  const level = active.value;
  if (level) enter(level);
}

function backToMap() {
  active.value = undefined;
  done.value = false;
  failed.value = false;
  guide('kid.tts.adventureIntro');
}

onMounted(() => {
  guide('kid.tts.adventureIntro');
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🗺️" title-key="kid.modules.adventure">
    <!-- 关卡地图 -->
    <div
      v-if="!active"
      class="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <button
        v-for="(level, index) in levels"
        :key="level.id"
        class="flex min-h-24 items-center gap-3 rounded-3xl p-4 text-left shadow-md transition sm:min-h-32 sm:gap-4 sm:p-5"
        data-star-anchor
        :class="
          unlockedAt(index)
            ? 'bg-white/60 backdrop-blur-xl hover:-translate-y-1 active:scale-95'
            : 'bg-white/40 opacity-60'
        "
        :disabled="!unlockedAt(index)"
        @click="unlockedAt(index) && enter(level)"
      >
        <span
          class="shrink-0 text-4xl sm:text-5xl"
          :class="unlockedAt(index) ? '' : 'grayscale'"
        >
          {{ unlockedAt(index) ? level.emoji : '🔒' }}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-lg font-black text-slate-700 sm:text-2xl">
            {{ level.title }}
          </span>
          <span class="text-sm text-slate-400 sm:text-base">
            {{ $t('kid.adventure.levelMeta', { n: level.questionCount }) }}
          </span>
        </span>
        <span v-if="isCleared(level.id)" class="ml-auto text-3xl sm:text-4xl">
          ⭐
        </span>
      </button>
    </div>

    <!-- 本关结算 -->
    <div v-else-if="done" class="flex flex-col items-center gap-4 sm:gap-6">
      <span class="text-6xl sm:text-8xl">🎉</span>
      <p class="text-center text-2xl font-black text-fuchsia-600 sm:text-4xl">
        {{ $t('kid.adventure.win', { title: active.title }) }}
      </p>
      <button
        class="min-h-20 rounded-full bg-fuchsia-500 px-8 text-2xl font-bold text-white shadow transition active:scale-90 sm:px-10"
        @click="backToMap"
      >
        {{ $t('kid.adventure.back') }}
      </button>
    </div>

    <!-- 失败：温和回落，不弹错误框 -->
    <div v-else-if="failed" class="flex flex-col items-center gap-4 sm:gap-6">
      <span class="text-6xl sm:text-8xl">💪</span>
      <p class="text-center text-xl font-black text-slate-600 sm:text-3xl">
        {{ $t('kid.adventure.retryTip') }}
      </p>
      <button
        class="min-h-20 rounded-full bg-fuchsia-500 px-8 text-2xl font-bold text-white shadow transition active:scale-90 sm:px-10"
        @click="retry"
      >
        {{ $t('kid.adventure.retry') }}
      </button>
      <button
        class="min-h-20 rounded-full bg-white/90 px-6 text-2xl font-bold text-slate-600 shadow transition active:scale-90 sm:px-8"
        @click="backToMap"
      >
        {{ $t('kid.adventure.back') }}
      </button>
    </div>

    <!-- 答题 -->
    <div
      v-else
      class="flex w-full max-w-4xl flex-col items-center"
      data-star-anchor
    >
      <div class="mb-4 flex items-center gap-3 sm:mb-6 sm:gap-6">
        <span class="text-2xl sm:text-3xl">
          <span v-for="n in HEARTS" :key="n">{{
            n <= hearts ? '❤️' : '🤍'
          }}</span>
        </span>
        <span class="text-lg font-bold text-slate-500 sm:text-xl">
          {{
            $t('kid.adventure.progress', {
              done: solved,
              total: active.questionCount,
            })
          }}
        </span>
        <button
          class="min-h-20 rounded-full bg-white/90 px-6 text-xl font-bold text-slate-600 shadow transition active:scale-90"
          @click="backToMap"
        >
          {{ $t('kid.adventure.back') }}
        </button>
      </div>

      <template v-if="quiz && quiz.options.length > 0">
        <p class="mb-8 text-center text-4xl font-black text-slate-700">
          {{ meta.prompt }}
        </p>
        <OptionGrid
          active-class="text-fuchsia-500"
          :options="quiz.options"
          @pick="pick"
        />
      </template>

      <p v-else class="text-2xl text-slate-400">
        {{ $t('kid.adventure.empty') }}
      </p>
    </div>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
