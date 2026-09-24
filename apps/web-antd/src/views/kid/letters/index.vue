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
import { useLetterPractice, useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const { bound } = useCurrentChild();
const { letters } = useContent();
const { guide, reward, rewardBadges, rewardShow, rewardText } = useReward();
const { askQuiz, createQuiz, sayLetter } = useLetterPractice();
const { next, pick, quiz, quizCount } = useQuiz<string>({
  ask: askQuiz,
  create: createQuiz,
  module: 'letters',
});

const mode = ref<'learn' | 'quiz'>('learn');
/** 本次会话已学过的字母（去重计星） */
const learned = ref<string[]>([]);

function onModeChange(value: 'learn' | 'quiz') {
  if (value === 'learn') {
    guide('kid.tts.lettersIntro');
  } else {
    next();
  }
}

function tapLetter(item: { letter: string; word: string; zh: string }) {
  sayLetter(item);
  if (!learned.value.includes(item.letter)) {
    learned.value = [...learned.value, item.letter];
    reward({
      detail: item.letter,
      itemId: item.letter,
      module: 'letters',
      praise: false,
    });
  }
}

onMounted(() => {
  guide('kid.tts.lettersIntro');
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🔤" title-key="kid.modules.letters">
    <ModeTabs
      v-model:mode="mode"
      active-class="bg-sky-400"
      :labels="{
        learn: $t('kid.letters.learn'),
        quiz: $t('kid.letters.quiz'),
      }"
      @change="onModeChange"
    />

    <!-- 学一学 -->
    <div
      v-if="mode === 'learn'"
      class="grid w-full max-w-4xl grid-cols-4 gap-4 sm:grid-cols-6"
    >
      <button
        v-for="item in letters"
        :key="item.letter"
        class="flex flex-col items-center gap-1 rounded-3xl bg-white/95 p-4 shadow-md transition hover:-translate-y-1 active:scale-90"
        @click="tapLetter(item)"
      >
        <span class="text-5xl font-black text-sky-500">{{ item.letter }}</span>
        <span class="text-3xl">{{ item.emoji }}</span>
      </button>
    </div>

    <!-- 考一考 -->
    <template v-else-if="quiz">
      <p class="mb-8 text-3xl font-bold text-slate-600">
        {{ $t('kid.letters.quizPrompt', { letter: quiz.answer }) }}
      </p>
      <OptionGrid
        active-class="text-sky-500"
        :options="quiz.options"
        @pick="pick"
      />
      <p class="mt-8 text-xl text-slate-400">
        {{ $t('kid.letters.questionNo', { n: quizCount }) }}
      </p>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
