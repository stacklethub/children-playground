<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import {
  useArithmeticPractice,
  useNumberPractice,
  useQuiz,
} from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const { bound } = useCurrentChild();
const { numbers } = useContent();
const { rewardBadges, rewardShow, rewardText, guide, reward } = useReward();

const mode = ref('learn');

// ---------- 认一认：单张大卡片翻页 ----------
const index = ref(0);
const learned = ref<number[]>([]);

const currentNumber = computed(() => numbers.value[index.value]);
const total = computed(() => numbers.value.length);
const atStart = computed(() => index.value <= 0);
const atEnd = computed(() => index.value >= total.value - 1);

/** 翻到上/下一个数字；已在两端返回 false，按钮会置灰 */
function step(delta: number) {
  const target = index.value + delta;
  if (target < 0 || target >= total.value) return false;
  index.value = target;
  return true;
}

function tapNumber(item: { num: number; word: string }) {
  sayNumber(item);
  if (learned.value.includes(item.num)) return;
  learned.value = [...learned.value, item.num];
  reward({
    detail: `${item.num}`,
    itemId: `${item.num}`,
    module: 'numbers',
    praise: false,
  });
}

// ---------- 玩一玩：数一数有几个 ----------
const { askQuiz, createQuiz, sayNumber } = useNumberPractice();
const quizEmoji = ref('⭐');

const {
  next: nextCount,
  pick: pickCount,
  quiz: countQuiz,
  quizCount: countNo,
} = useQuiz<number>({
  ask: askQuiz,
  create: () => {
    const created = createQuiz();
    quizEmoji.value = created.emoji;
    return { answer: created.answer, options: created.options };
  },
  module: 'numbers',
});

// ---------- 算一算：10 以内加减 ----------
const { createQuiz: createArith } = useArithmeticPractice();
const arithMeta = ref({ expr: '', isMinus: false, left: 0, right: 0 });

const {
  next: nextArith,
  pick: pickArith,
  quiz: arithQuiz,
  quizCount: arithNo,
} = useQuiz<number>({
  ask: () => {
    const { isMinus, left, right } = arithMeta.value;
    speak(
      $t(isMinus ? 'kid.tts.arithMinus' : 'kid.tts.arithPlus', { left, right }),
    );
  },
  create: () => {
    const created = createArith();
    arithMeta.value = {
      expr: created.expr,
      isMinus: created.isMinus,
      left: created.left,
      right: created.right,
    };
    return { answer: created.answer, options: created.options };
  },
  module: 'numbers',
});

const tabs = [
  { key: 'learn', label: $t('kid.numbers.learn') },
  { key: 'arith', label: $t('kid.numbers.arithmetic') },
  { key: 'count', label: $t('kid.numbers.quiz') },
];

function onModeChange(key: string) {
  if (key === 'learn') {
    guide('kid.tts.numbersIntro');
  } else if (key === 'arith') {
    nextArith();
  } else {
    nextCount();
  }
}

onMounted(() => {
  guide('kid.tts.numbersIntro');
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🔢" title-key="kid.modules.numbers">
    <KidTabs
      v-model:model="mode"
      active-class="bg-emerald-400"
      :items="tabs"
      @change="onModeChange"
    />

    <!-- 认一认：一进来就是一个数字大卡片，左右翻页 -->
    <template v-if="mode === 'learn' && currentNumber">
      <button
        class="relative flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-10 shadow-2xl transition hover:-translate-y-1 active:scale-95"
        data-star-anchor
        @click="tapNumber(currentNumber)"
      >
        <span
          class="absolute left-6 top-6 flex max-w-[calc(100%-3rem)] flex-wrap text-3xl leading-none"
        >
          <span v-for="n in currentNumber.count" :key="n">
            {{ currentNumber.emoji }}
          </span>
        </span>
        <span class="text-[9rem] leading-none font-black text-emerald-500">
          {{ currentNumber.num }}
        </span>
        <span class="text-3xl font-bold text-slate-500">
          {{ currentNumber.word }}
        </span>
      </button>

      <nav class="mt-8 flex items-center gap-6">
        <button
          class="rounded-full bg-white/90 px-8 py-4 text-2xl font-bold text-slate-600 shadow transition active:scale-95 disabled:opacity-40"
          :disabled="atStart"
          @click="step(-1)"
        >
          ← {{ $t('kid.numbers.prev') }}
        </button>
        <span class="text-2xl font-bold text-slate-600">
          {{ index + 1 }} / {{ total }}
        </span>
        <button
          class="rounded-full bg-emerald-400 px-8 py-4 text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40"
          :disabled="atEnd"
          @click="step(1)"
        >
          {{ $t('kid.numbers.next') }} →
        </button>
      </nav>
    </template>

    <!-- 算一算 -->
    <template v-else-if="mode === 'arith'">
      <template v-if="arithQuiz">
        <p class="mb-6 text-7xl font-black text-emerald-500">
          {{ arithMeta.expr }}
        </p>
        <OptionGrid
          active-class="text-emerald-500"
          :options="arithQuiz.options"
          @pick="pickArith"
        />
        <p class="mt-8 text-xl text-slate-400">
          {{ $t('kid.numbers.questionNo', { n: arithNo }) }}
        </p>
      </template>
    </template>

    <!-- 玩一玩：数一数有几个 -->
    <template v-else-if="countQuiz">
      <p class="mb-6 text-3xl font-bold text-slate-600">
        {{ $t('kid.numbers.quizPrompt') }}
      </p>
      <div
        class="mb-8 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-3xl bg-white/95 p-8 shadow-xl"
        data-star-anchor
      >
        <span v-for="n in countQuiz.answer" :key="n" class="text-7xl">
          {{ quizEmoji }}
        </span>
      </div>
      <OptionGrid
        active-class="text-emerald-500"
        :options="countQuiz.options"
        @pick="pickCount"
      />
      <p class="mt-8 text-xl text-slate-400">
        {{ $t('kid.numbers.questionNo', { n: countNo }) }}
      </p>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
