<script setup lang="ts">
import type { LogicKind } from '#/data/content';
import type { LearnModule } from '#/store';

import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidPager from '../components/kid-pager.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'logic';

const { bound, childId } = useCurrentChild();
const { logicItems } = useContent();
const { guide, reward, rewardBadges, rewardShow, rewardText, wrong } =
  useReward();
const kidStore = useKidStore();

const kind = ref<LogicKind>('pattern');

const tabs = [
  { label: $t('kid.logic.pattern'), value: 'pattern' },
  { label: $t('kid.logic.sort'), value: 'sort' },
  { label: $t('kid.logic.compare'), value: 'compare' },
  { label: $t('kid.logic.match'), value: 'match' },
];

// ---------- 题目：选择题，手动翻页 ----------
interface QuizCard {
  /** 正确答案 */
  answer: string;
  /** 题干（中文朗读） */
  prompt: string;
  /** 选项 */
  options: string[];
  /** 错题本条目标识 */
  itemId: string;
  /** 是否已答对（答对后锁定，翻回不再判分） */
  solved: boolean;
}

const quizCards = ref<QuizCard[]>([]);
const quizIndex = ref(0);

const quizCurrent = computed(() => quizCards.value[quizIndex.value]);
const quizAtStart = computed(() => quizIndex.value <= 0);
const quizAtEnd = computed(() => quizIndex.value >= quizCards.value.length - 1);

/** 生成当前题型的一组题目（随机顺序），支持「上一个/下一个」回看 */
function buildQuiz() {
  const pool = logicItems.value
    .filter((item) => item.kind === kind.value)
    .toSorted(() => Math.random() - 0.5);
  quizCards.value = pool.map((item) => ({
    answer: item.answer,
    itemId: item.id,
    options: [...item.options],
    prompt: item.prompt,
    solved: false,
  }));
  quizIndex.value = 0;
}

/** 点题干：朗读题目（中文），不泄露答案 */
function sayPrompt() {
  const card = quizCurrent.value;
  if (!card) return;
  speak(card.prompt, { lang: CONTENT_TTS_LANG });
}

/** 点选项：判分。答对记星并锁定，答错进错题本；不再自动跳下一题 */
function answerCard(value: string) {
  const card = quizCurrent.value;
  if (!card || card.solved) return;
  const child = childId.value;
  if (value === card.answer) {
    card.solved = true;
    if (child) kidStore.removeWrong(child, MODULE, card.itemId);
    reward({
      itemId: card.itemId,
      module: MODULE,
      stars: 2,
    });
  } else {
    if (child) kidStore.addWrong(child, MODULE, card.itemId);
    wrong();
  }
}

/** 翻页；已在两端返回 false，按钮会置灰 */
function quizStep(delta: number) {
  const target = quizIndex.value + delta;
  if (target < 0 || target >= quizCards.value.length) return false;
  quizIndex.value = target;
  return true;
}

function onKindChange() {
  buildQuiz();
}

onMounted(() => {
  guide('kid.tts.logicIntro');
  buildQuiz();
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🧩" title-key="kid.modules.logic">
    <KidTabs v-model="kind" accent="sun" :items="tabs" @change="onKindChange" />

    <template v-if="quizCurrent">
      <!-- 题干：点一下朗读题目 -->
      <button
        class="mb-4 flex items-center gap-4 sm:mb-8"
        data-star-anchor
        type="button"
        @click="sayPrompt"
      >
        <span
          class="text-center text-2xl font-black text-slate-700 sm:text-4xl"
        >
          {{ quizCurrent.prompt }}
        </span>
      </button>

      <!-- 选项：点选判分，答对后锁定 -->
      <OptionGrid
        active-class="text-cyan-500"
        :options="quizCurrent.options"
        @pick="answerCard"
      />

      <KidPager
        accent="sun"
        :at-end="quizAtEnd"
        :at-start="quizAtStart"
        :current="quizIndex"
        :total="quizCards.length"
        @next="quizStep(1)"
        @prev="quizStep(-1)"
      >
        <template #prev>{{ $t('kid.logic.prev') }}</template>
        <template #next>{{ $t('kid.logic.next') }}</template>
      </KidPager>
    </template>

    <p v-else class="text-2xl text-slate-400">
      {{ $t('kid.logic.empty') }}
    </p>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
