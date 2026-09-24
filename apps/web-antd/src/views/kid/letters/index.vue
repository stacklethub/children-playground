<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { speak } from '#/utils/tts';

import StarToast from '../components/star-toast.vue';
import { useReward } from '../hooks/use-reward';

const { letters } = useContent();
const { guide, reward, rewardShow, rewardText, rewardBadges, wrong } =
  useReward();

/** learn 学一学 | quiz 考一考 */
const mode = ref<'learn' | 'quiz'>('learn');

// ---------- 学一学 ----------
const learnedLetters = new Set<string>();

function tapLetter(item: { letter: string; word: string; zh: string }) {
  speak(`${item.letter}，${item.zh}，${item.word}`);
  if (!learnedLetters.has(item.letter)) {
    learnedLetters.add(item.letter);
    reward({
      detail: item.letter,
      itemId: item.letter,
      module: 'letters',
      praise: false,
      stars: 1,
    });
  }
}

// ---------- 考一考 ----------
interface QuizItem {
  answer: string;
  options: string[];
}

const quiz = ref<QuizItem>();
const quizCount = ref(0);

function newQuiz() {
  const pool = letters.value;
  const answer = pool[Math.floor(Math.random() * pool.length)]!;
  const others = pool
    .filter((l) => l.letter !== answer.letter)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((l) => l.letter);
  quiz.value = {
    answer: answer.letter,
    options: [answer.letter, ...others].sort(() => Math.random() - 0.5),
  };
  quizCount.value += 1;
  speak(`找一找，字母 ${answer.letter} 在哪里呀？`);
}

function pick(option: string) {
  if (!quiz.value) return;
  if (option === quiz.value.answer) {
    reward({
      detail: option,
      itemId: quiz.value.answer,
      module: 'letters',
      stars: 2,
    });
    setTimeout(newQuiz, 1400);
  } else {
    wrong();
  }
}

const quizText = computed(() =>
  quiz.value ? `字母 ${quiz.value.answer} 藏在哪里？` : '',
);

onMounted(() => {
  guide('点一点字母，跟它打个招呼吧！');
  newQuiz();
});
</script>

<template>
  <div class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <h1 class="mb-4 text-4xl font-black text-slate-700">字母乐园 🔤</h1>

    <!-- 模式切换 -->
    <div class="mb-8 flex gap-4 rounded-full bg-white/70 p-2">
      <button
        class="rounded-full px-10 py-3 text-2xl font-bold transition"
        :class="mode === 'learn' ? 'bg-sky-400 text-white shadow' : 'text-slate-500'"
        @click="mode = 'learn'; guide('点一点字母，跟它打个招呼吧！')"
      >
        学一学
      </button>
      <button
        class="rounded-full px-10 py-3 text-2xl font-bold transition"
        :class="mode === 'quiz' ? 'bg-orange-400 text-white shadow' : 'text-slate-500'"
        @click="mode = 'quiz'; newQuiz()"
      >
        考一考
      </button>
    </div>

    <!-- 学一学：字母表 -->
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

    <!-- 考一考：找出字母 -->
    <template v-else-if="quiz">
      <p class="mb-8 text-3xl font-bold text-slate-600">{{ quizText }}</p>
      <div class="grid w-full max-w-2xl grid-cols-2 gap-6">
        <button
          v-for="option in quiz.options"
          :key="option"
          class="rounded-3xl bg-white/95 py-10 text-7xl font-black text-sky-500 shadow-xl transition active:scale-90"
          @click="pick(option)"
        >
          {{ option }}
        </button>
      </div>
      <p class="mt-8 text-xl text-slate-400">第 {{ quizCount }} 题</p>
    </template>

    <StarToast :show="rewardShow" :text="rewardText" :badges="rewardBadges" />
  </div>
</template>
