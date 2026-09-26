<script setup lang="ts">
import type { KidLetter } from '#/data/content';
import type { LearnModule } from '#/store';

import { computed, onMounted, ref, watch } from 'vue';

import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useLetterSession } from '../hooks/use-letter-session';
import { useLetterPractice, useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'letters';

const { bound } = useCurrentChild();
const { guide, reward, rewardBadges, rewardShow, rewardText } = useReward();
const { createQuiz, sayLetter, sayWord } = useLetterPractice();
const { atEnd, atStart, current, index, next, prev, total } =
  useLetterSession();

const mode = ref('learn');
/** 认字母与学单词共用同一张卡片与同一套翻页，停在同一张上方便「看这个字母的单词」 */
const isFlipMode = computed(
  () => mode.value === 'learn' || mode.value === 'word',
);
/** 认字母卡片是否翻到了小写那一面 */
const flipped = ref(false);
/** 本次会话已学过的条目（字母与单词各计一次），用于去重加星 */
const learned = ref<string[]>([]);
const meta = ref<{ itemId: string; mode: 'letter' | 'word'; word: string }>({
  itemId: '',
  mode: 'letter',
  word: '',
});

const tabs = [
  { label: $t('kid.letters.learn'), value: 'learn' },
  { label: $t('kid.letters.word'), value: 'word' },
  { label: $t('kid.letters.quiz'), value: 'quiz' },
];

const {
  next: nextQuiz,
  pick,
  quiz,
  quizCount,
} = useQuiz<string>({
  ask: () => {
    if (meta.value.mode === 'letter') {
      speak($t('kid.tts.lettersQuiz', { letter: meta.value.itemId }));
      return;
    }
    // 题干是英文单词，读英文发音；中文问句已显示在页面上
    speak(meta.value.word, { lang: 'en-US' });
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

/** 点字母卡：翻面看小写，同时读一遍 */
function tapLetterCard(item: KidLetter) {
  flipped.value = !flipped.value;
  sayLetter(item);
  markLearned(item.letter, item.word);
}

function tapWord(item: KidLetter) {
  sayWord(item);
  markLearned(`w-${item.letter}`, item.word);
}

// 换字母或换子模式都回到正面，免得新字母一上来就是小写
watch([index, mode], () => {
  flipped.value = false;
});

function onModeChange(key: string) {
  if (key === 'learn') {
    guide('kid.tts.lettersIntro');
  } else if (key === 'word') {
    guide('kid.tts.lettersWordIntro');
  } else {
    nextQuiz();
  }
}

onMounted(() => {
  guide('kid.tts.lettersIntro');
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🔤" title-key="kid.modules.letters">
    <KidTabs v-model="mode" accent="sky" :items="tabs" @change="onModeChange" />

    <!-- 认字母 / 学单词：一进来就是一张大卡片，左右翻页 -->
    <template v-if="isFlipMode && current">
      <!-- 认字母：大字是主角，点一下翻到小写那一面 -->
      <button
        v-if="mode === 'learn'"
        class="h-[52vh] min-h-[300px] w-full max-w-xl [perspective:1200px]"
        data-star-anchor
        @click="tapLetterCard(current)"
      >
        <span
          class="relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
          :class="{ '[transform:rotateY(180deg)]': flipped }"
        >
          <span
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-10 shadow-2xl [backface-visibility:hidden]"
          >
            <span class="absolute left-8 top-8 text-4xl leading-none">
              {{ current.emoji }}
            </span>
            <span class="text-[10rem] leading-none font-black text-sky-500">
              {{ current.letter }}
            </span>
            <span class="text-xl text-slate-400">
              {{ $t('kid.cards.tapHint') }} 👆
            </span>
          </span>

          <span
            class="absolute inset-0 flex items-center justify-center rounded-[3rem] bg-white/95 p-10 shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <span class="text-[10rem] leading-none font-black text-sky-300">
              {{ current.lower }}
            </span>
          </span>
        </span>
      </button>

      <!-- 学单词：单词是主角，图案退成提示 -->
      <button
        v-else
        class="relative flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-10 shadow-2xl transition hover:-translate-y-1 active:scale-95"
        data-star-anchor
        @click="tapWord(current)"
      >
        <span class="absolute left-8 top-8 text-[3rem] leading-none">
          {{ current.emoji }}
        </span>
        <span class="text-6xl font-black text-sky-600">{{ current.word }}</span>
        <span class="text-3xl font-bold text-slate-600">{{ current.zh }}</span>
        <span class="text-lg text-slate-400">{{ current.sentence }}</span>
        <span class="text-xl text-slate-400">
          {{ $t('kid.cards.tapHint') }} 👆
        </span>
      </button>

      <nav class="mt-8 flex items-center gap-6">
        <button
          class="rounded-full bg-white/90 px-8 py-4 text-2xl font-bold text-slate-600 shadow transition active:scale-95 disabled:opacity-40"
          :disabled="atStart"
          @click="prev()"
        >
          ← {{ $t('kid.letters.prev') }}
        </button>
        <span class="text-2xl font-bold text-slate-600">
          {{ index + 1 }} / {{ total }}
        </span>
        <button
          class="rounded-full bg-orange-400 px-8 py-4 text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40"
          :disabled="atEnd"
          @click="next()"
        >
          {{ $t('kid.letters.next') }} →
        </button>
      </nav>
    </template>

    <!-- 考一考：认字母 + 学单词 -->
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
