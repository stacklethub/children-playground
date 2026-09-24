<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import ModeTabs from '../components/mode-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useNumberPractice, useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const { bound } = useCurrentChild();
const { numbers } = useContent();
const { rewardBadges, rewardShow, rewardText, guide, reward } = useReward();
const { askQuiz, createQuiz, sayNumber } = useNumberPractice();
const { next, pick, quiz, quizCount } = useQuiz<number>({
  ask: askQuiz,
  create: () => {
    const created = createQuiz();
    quizEmoji.value = created.emoji;
    return { answer: created.answer, options: created.options };
  },
  module: 'numbers',
});

const mode = ref<'learn' | 'quiz'>('learn');
const quizEmoji = ref('⭐');
const learned = ref<number[]>([]);

function onModeChange(value: 'learn' | 'quiz') {
  if (value === 'learn') {
    guide('kid.tts.numbersIntro');
  } else {
    next();
  }
}

function tapNumber(item: { num: number; word: string }) {
  sayNumber(item);
  if (!learned.value.includes(item.num)) {
    learned.value = [...learned.value, item.num];
    reward({
      detail: `${item.num}`,
      itemId: `${item.num}`,
      module: 'numbers',
      praise: false,
    });
  }
}

onMounted(() => {
  guide('kid.tts.numbersIntro');
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🔢" title-key="kid.modules.numbers">
    <ModeTabs
      v-model:mode="mode"
      active-class="bg-emerald-400"
      :labels="{
        learn: $t('kid.numbers.learn'),
        quiz: $t('kid.numbers.quiz'),
      }"
      @change="onModeChange"
    />

    <!-- 学一学 -->
    <div
      v-if="mode === 'learn'"
      class="grid w-full max-w-4xl grid-cols-3 gap-4 sm:grid-cols-5"
    >
      <button
        v-for="item in numbers"
        :key="item.num"
        class="flex flex-col items-center gap-1 rounded-3xl bg-white/95 p-4 shadow-md transition hover:-translate-y-1 active:scale-90"
        @click="tapNumber(item)"
      >
        <span class="text-6xl font-black text-emerald-500">{{ item.num }}</span>
        <span class="text-2xl font-bold text-slate-500">{{ item.word }}</span>
        <span class="text-lg">
          <span v-for="n in item.count" :key="n">{{ item.emoji }}</span>
        </span>
      </button>
    </div>

    <!-- 考一考 -->
    <template v-else-if="quiz">
      <p class="mb-6 text-3xl font-bold text-slate-600">
        {{ $t('kid.numbers.quizPrompt') }}
      </p>
      <div
        class="mb-8 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-3xl bg-white/95 p-8 shadow-xl"
      >
        <span v-for="n in quiz.answer" :key="n" class="text-7xl">
          {{ quizEmoji }}
        </span>
      </div>
      <OptionGrid
        active-class="text-emerald-500"
        :options="quiz.options"
        @pick="pick"
      />
      <p class="mt-8 text-xl text-slate-400">
        {{ $t('kid.numbers.questionNo', { n: quizCount }) }}
      </p>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
