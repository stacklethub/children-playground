<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidFlashCard from '../components/kid-flash-card.vue';
import KidPage from '../components/kid-page.vue';
import KidPager from '../components/kid-pager.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useArithmeticPractice, useNumberPractice } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const { bound } = useCurrentChild();
const { numbers } = useContent();
const { rewardBadges, rewardShow, rewardText, guide, reward, wrong } =
  useReward();

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
    itemId: `${item.num}`,
    module: 'numbers',
    praise: false,
  });
}

// ---------- 玩一玩：数一数有几个 ----------
const { askQuiz, createQuiz, sayNumber } = useNumberPractice();

interface CountCard {
  answer: number;
  emoji: string;
  options: number[];
  solved: boolean;
}

const countCards = ref<CountCard[]>([]);
const countIndex = ref(0);
const countCurrent = computed(() => countCards.value[countIndex.value]);
const countAtStart = computed(() => countIndex.value <= 0);
const countAtEnd = computed(
  () => countIndex.value >= countCards.value.length - 1,
);

/** 生成一组「数一数」题，支持上一个/下一个回看 */
function buildCountQuiz() {
  countCards.value = numbers.value.map(() => {
    const created = createQuiz();
    return {
      answer: created.answer,
      emoji: created.emoji,
      options: created.options,
      solved: false,
    };
  });
  countIndex.value = 0;
}

/** 点题干：朗读「数一数有几个」 */
function sayCountPrompt() {
  askQuiz();
}

/** 判分：答对记星并锁定，答错语音鼓励；不再自动跳题 */
function answerCount(value: number) {
  const card = countCurrent.value;
  if (!card || card.solved) return;
  if (value === card.answer) {
    card.solved = true;
    reward({
      detail: `${card.answer}`,
      itemId: `${card.answer}`,
      module: 'numbers',
      stars: 2,
    });
  } else {
    wrong();
  }
}

function countStep(delta: number) {
  const target = countIndex.value + delta;
  if (target < 0 || target >= countCards.value.length) return false;
  countIndex.value = target;
  return true;
}

// ---------- 算一算：10 以内加减 ----------
const { createQuiz: createArith } = useArithmeticPractice();

interface ArithCard {
  answer: number;
  expr: string;
  isMinus: boolean;
  left: number;
  right: number;
  options: number[];
  solved: boolean;
}

const arithCards = ref<ArithCard[]>([]);
const arithIndex = ref(0);
const arithCurrent = computed(() => arithCards.value[arithIndex.value]);
const arithAtStart = computed(() => arithIndex.value <= 0);
const arithAtEnd = computed(
  () => arithIndex.value >= arithCards.value.length - 1,
);

/** 生成一组加减题，支持上一个/下一个回看 */
function buildArithQuiz() {
  arithCards.value = numbers.value.map(() => {
    const created = createArith();
    return {
      answer: created.answer,
      expr: created.expr,
      isMinus: created.isMinus,
      left: created.left,
      options: created.options,
      right: created.right,
      solved: false,
    };
  });
  arithIndex.value = 0;
}

/** 点题干：朗读算式 */
function sayArithPrompt() {
  const card = arithCurrent.value;
  if (!card) return;
  speak(
    $t(card.isMinus ? 'kid.tts.arithMinus' : 'kid.tts.arithPlus', {
      left: card.left,
      right: card.right,
    }),
  );
}

/** 判分：答对记星并锁定，答错语音鼓励；不再自动跳题 */
function answerArith(value: number) {
  const card = arithCurrent.value;
  if (!card || card.solved) return;
  if (value === card.answer) {
    card.solved = true;
    reward({
      detail: card.expr,
      itemId: card.expr,
      module: 'numbers',
      stars: 2,
    });
  } else {
    wrong();
  }
}

function arithStep(delta: number) {
  const target = arithIndex.value + delta;
  if (target < 0 || target >= arithCards.value.length) return false;
  arithIndex.value = target;
  return true;
}

const tabs = [
  { label: $t('kid.numbers.learn'), value: 'learn' },
  { label: $t('kid.numbers.arithmetic'), value: 'arith' },
  { label: $t('kid.numbers.quiz'), value: 'count' },
];

function onModeChange(key: string) {
  if (key === 'learn') {
    guide('kid.tts.numbersIntro');
  } else if (key === 'arith') {
    buildArithQuiz();
  } else {
    buildCountQuiz();
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
      v-model="mode"
      accent="lilac"
      :items="tabs"
      @change="onModeChange"
    />

    <!-- 认一认：一进来就是一个数字大卡片，左右翻页 -->
    <template v-if="mode === 'learn' && currentNumber">
      <KidFlashCard @tap="tapNumber(currentNumber)">
        <span
          class="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap text-2xl leading-none sm:left-6 sm:top-6 sm:max-w-[calc(100%-3rem)] sm:text-3xl"
        >
          <span v-for="n in currentNumber.count" :key="n">
            {{ currentNumber.emoji }}
          </span>
        </span>
        <span
          class="text-[clamp(4rem,20vw,9rem)] leading-none font-black text-emerald-500"
        >
          {{ currentNumber.num }}
        </span>
        <span class="text-2xl font-bold text-slate-500 sm:text-3xl">
          {{ currentNumber.word }}
        </span>
      </KidFlashCard>

      <KidPager
        accent="lilac"
        :at-end="atEnd"
        :at-start="atStart"
        :current="index"
        :total="total"
        @next="step(1)"
        @prev="step(-1)"
      >
        <template #prev>{{ $t('kid.numbers.prev') }}</template>
        <template #next>{{ $t('kid.numbers.next') }}</template>
      </KidPager>
    </template>

    <!-- 算一算：题干可点朗读 + 点选项判分 + 翻页 -->
    <template v-else-if="mode === 'arith' && arithCurrent">
      <button
        class="mb-4 flex items-center gap-4 sm:mb-6"
        data-star-anchor
        type="button"
        @click="sayArithPrompt"
      >
        <span
          class="text-[clamp(2.5rem,12vw,4.5rem)] font-black text-emerald-500"
        >
          {{ arithCurrent.expr }}
        </span>
      </button>
      <OptionGrid
        active-class="text-emerald-500"
        :options="arithCurrent.options"
        @pick="answerArith"
      />
      <KidPager
        accent="lilac"
        :at-end="arithAtEnd"
        :at-start="arithAtStart"
        :current="arithIndex"
        :total="arithCards.length"
        @next="arithStep(1)"
        @prev="arithStep(-1)"
      >
        <template #prev>{{ $t('kid.numbers.prev') }}</template>
        <template #next>{{ $t('kid.numbers.next') }}</template>
      </KidPager>
    </template>

    <!-- 玩一玩：数一数有几个 -->
    <template v-else-if="mode === 'count' && countCurrent">
      <button
        class="mb-4 flex items-center gap-4 sm:mb-6"
        data-star-anchor
        type="button"
        @click="sayCountPrompt"
      >
        <span class="text-2xl font-bold text-slate-600 sm:text-3xl">
          {{ $t('kid.numbers.quizPrompt') }}
        </span>
      </button>
      <div
        class="mb-6 flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/60 bg-white/55 p-5 shadow-lg backdrop-blur-xl sm:mb-8 sm:gap-3 sm:p-8"
      >
        <span
          v-for="n in countCurrent.answer"
          :key="n"
          class="text-4xl sm:text-7xl"
        >
          {{ countCurrent.emoji }}
        </span>
      </div>
      <OptionGrid
        active-class="text-emerald-500"
        :options="countCurrent.options"
        @pick="answerCount"
      />
      <KidPager
        accent="lilac"
        :at-end="countAtEnd"
        :at-start="countAtStart"
        :current="countIndex"
        :total="countCards.length"
        @next="countStep(1)"
        @prev="countStep(-1)"
      >
        <template #prev>{{ $t('kid.numbers.prev') }}</template>
        <template #next>{{ $t('kid.numbers.next') }}</template>
      </KidPager>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
