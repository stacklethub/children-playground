<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { speak } from '#/utils/tts';

import StarToast from '../components/star-toast.vue';
import { useReward } from '../hooks/use-reward';

const { numbers } = useContent();
const { guide, reward, rewardShow, rewardText, rewardBadges, wrong } =
  useReward();

/** learn 数一数 | quiz 考一考 */
const mode = ref<'learn' | 'quiz'>('learn');

// ---------- 学一学 ----------
const learnedNums = new Set<number>();

function tapNumber(item: { emoji: string; num: number; word: string }) {
  // 朗读数字、汉字并带着孩子数数
  speak(
    `这是数字 ${item.word}，跟着我数：${Array.from({ length: item.num }, () => item.word).join('，')}`,
  );
  if (!learnedNums.has(item.num)) {
    learnedNums.add(item.num);
    reward({
      detail: `${item.num}`,
      itemId: `${item.num}`,
      module: 'numbers',
      praise: false,
      stars: 1,
    });
  }
}

// ---------- 考一考：数一数有几个 ----------
interface QuizItem {
  answer: number;
  emoji: string;
  options: number[];
}

const quiz = ref<QuizItem>();
const quizCount = ref(0);

function newQuiz() {
  const pool = numbers.value;
  const item = pool[Math.floor(Math.random() * pool.length)]!;
  const options = new Set<number>([item.count]);
  while (options.size < 3) {
    options.add(1 + Math.floor(Math.random() * 10));
  }
  quiz.value = {
    answer: item.count,
    emoji: item.emoji,
    options: [...options].sort(() => Math.random() - 0.5),
  };
  quizCount.value += 1;
  speak(`数一数，有几个呀？`);
}

function pick(option: number) {
  if (!quiz.value) return;
  if (option === quiz.value.answer) {
    reward({
      detail: `${quiz.value.answer}`,
      itemId: `${quiz.value.answer}`,
      module: 'numbers',
      stars: 2,
    });
    setTimeout(newQuiz, 1400);
  } else {
    wrong();
  }
}

onMounted(() => {
  guide('点一点数字，一起数一数吧！');
  newQuiz();
});
</script>

<template>
  <div class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <h1 class="mb-4 text-4xl font-black text-slate-700">数字小屋 🔢</h1>

    <!-- 模式切换 -->
    <div class="mb-8 flex gap-4 rounded-full bg-white/70 p-2">
      <button
        class="rounded-full px-10 py-3 text-2xl font-bold transition"
        :class="mode === 'learn' ? 'bg-emerald-400 text-white shadow' : 'text-slate-500'"
        @click="mode = 'learn'; guide('点一点数字，一起数一数吧！')"
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

    <!-- 学一学：数字 1-10 -->
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

    <!-- 考一考：数一数 -->
    <template v-else-if="quiz">
      <p class="mb-6 text-3xl font-bold text-slate-600">数一数，有几个？</p>
      <div class="mb-8 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-3xl bg-white/95 p-8 shadow-xl">
        <span
          v-for="n in quiz.answer"
          :key="n"
          class="text-7xl"
        >
          {{ quiz.emoji }}
        </span>
      </div>
      <div class="grid w-full max-w-2xl grid-cols-3 gap-6">
        <button
          v-for="option in quiz.options"
          :key="option"
          class="rounded-3xl bg-white/95 py-8 text-6xl font-black text-emerald-500 shadow-xl transition active:scale-90"
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
