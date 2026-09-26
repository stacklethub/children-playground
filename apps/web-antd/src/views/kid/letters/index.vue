<script setup lang="ts">
import { onMounted, ref } from 'vue';

import type { KidLetter } from '#/data/content';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { type LearnModule } from '#/store';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useLetterPractice, useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'letters';

const { bound } = useCurrentChild();
const { letters } = useContent();
const { guide, reward, rewardBadges, rewardShow, rewardText } = useReward();
const { createQuiz, sayLetter, sayWord } = useLetterPractice();

const mode = ref('learn');
/** 本次会话已学过的条目（字母与单词各计一次），用于去重加星 */
const learned = ref<string[]>([]);
const meta = ref<{ itemId: string; mode: 'letter' | 'word'; word: string }>({
  itemId: '',
  mode: 'letter',
  word: '',
});

const tabs = [
  { key: 'learn', label: $t('kid.letters.learn') },
  { key: 'word', label: $t('kid.letters.word') },
  { key: 'quiz', label: $t('kid.letters.quiz') },
];

const { next, pick, quiz, quizCount } = useQuiz<string>({
  ask: () => {
    if (meta.value.mode === 'letter') {
      speak($t('kid.tts.lettersQuiz', { letter: meta.value.itemId }));
      return;
    }
    // 题干是英文单词，用英文语音，避免中文语音把字母念成怪音
    speak($t('kid.tts.lettersWordQuiz', { word: meta.value.word }), {
      lang: 'en-US',
    });
  },
  create: () => {
    const created = createQuiz();
    meta.value = {
      itemId: created.itemId,
      mode: created.mode,
      word: created.word,
    };
    return { answer: created.answer, options: created.options };
  },
  itemIdOf: () => meta.value.itemId,
  module: MODULE,
});

function markLearned(key: string, detail: string) {
  if (learned.value.includes(key)) return;
  learned.value = [...learned.value, key];
  reward({ detail, itemId: key, module: MODULE, praise: false });
}

function tapLetter(item: KidLetter) {
  sayLetter(item);
  markLearned(item.letter, item.word);
}

function tapWord(item: KidLetter) {
  sayWord(item);
  markLearned(`w-${item.letter}`, item.word);
}

function onModeChange(key: string) {
  if (key === 'learn') {
    guide('kid.tts.lettersIntro');
  } else if (key === 'word') {
    guide('kid.tts.lettersWordIntro');
  } else {
    next();
  }
}

onMounted(() => {
  guide('kid.tts.lettersIntro');
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🔤" title-key="kid.modules.letters">
    <KidTabs
      v-model:model="mode"
      active-class="bg-sky-400"
      :items="tabs"
      @change="onModeChange"
    />

    <!-- 学一学：大小写字母 -->
    <div
      v-if="mode === 'learn'"
      class="grid w-full max-w-4xl grid-cols-3 gap-4 sm:grid-cols-6"
    >
      <button
        v-for="item in letters"
        :key="item.letter"
        class="flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl bg-white/95 p-4 shadow-md transition hover:-translate-y-1 active:scale-90"
        @click="tapLetter(item)"
      >
        <span class="text-4xl font-black text-sky-500">
          {{ item.letter }}<span class="text-2xl text-sky-300">{{ item.lower }}</span>
        </span>
        <span class="text-3xl">{{ item.emoji }}</span>
      </button>
    </div>

    <!-- 认单词：单词 / 释义 / 例句 -->
    <div
      v-else-if="mode === 'word'"
      class="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <button
        v-for="item in letters"
        :key="`w-${item.letter}`"
        class="flex min-h-32 items-center gap-4 rounded-3xl bg-white/95 p-5 text-left shadow-md transition hover:-translate-y-1 active:scale-95"
        @click="tapWord(item)"
      >
        <span class="text-5xl">{{ item.emoji }}</span>
        <span class="flex flex-col">
          <span class="text-3xl font-black text-sky-600">{{ item.word }}</span>
          <span class="text-xl font-bold text-slate-600">{{ item.zh }}</span>
          <span class="text-base text-slate-400">{{ item.sentence }}</span>
        </span>
      </button>
    </div>

    <!-- 考一考：认字母 + 认单词 -->
    <template v-else-if="quiz && quiz.options.length > 0">
      <p class="mb-8 text-center text-3xl font-bold text-slate-600">
        {{
          meta.mode === 'letter'
            ? $t('kid.letters.quizPrompt', { letter: meta.itemId })
            : $t('kid.letters.wordQuizPrompt', { word: meta.word })
        }}
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
