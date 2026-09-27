<script setup lang="ts">
import type { KidLetter } from '#/data/content';
import type { LetterItem } from '#/data/use-content';
import type { LearnModule } from '#/store';

import { computed, onMounted, ref, watch } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidFlashCard from '../components/kid-flash-card.vue';
import KidPage from '../components/kid-page.vue';
import KidPager from '../components/kid-pager.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useLetterSession } from '../hooks/use-letter-session';
import { useLetterPractice } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'letters';

const { bound, childId } = useCurrentChild();
const { guide, reward, rewardBadges, rewardShow, rewardText, wrong } =
  useReward();
const { letters } = useContent();
const { createQuiz, sayLetter, sayWord } = useLetterPractice();
const kidStore = useKidStore();
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

/** 错题本里的字母（按 itemId 映射回内容，孤儿项静默丢弃） */
const wrongItems = computed(() => {
  const child = childId.value;
  if (!child) return [];
  const byLetter = new Map(letters.value.map((l) => [l.letter, l]));
  return kidStore
    .wrongOf(child, MODULE)
    .map((w) => byLetter.get(w.itemId))
    .filter((item): item is LetterItem => Boolean(item));
});

const tabs = computed(() => {
  const list = [
    { label: $t('kid.letters.learn'), value: 'learn' },
    { label: $t('kid.letters.word'), value: 'word' },
    { label: $t('kid.letters.quiz'), value: 'quiz' },
  ];
  if (wrongItems.value.length > 0) {
    list.push({
      label: $t('kid.letters.wrongs', { n: wrongItems.value.length }),
      value: 'wrongs',
    });
  }
  return list;
});

// ---------- 错题本：裸大字复习 + 记住了移出 ----------
const wrongIndex = ref(0);
const wrongCurrent = computed(() => wrongItems.value[wrongIndex.value]);
const wrongAtStart = computed(() => wrongIndex.value <= 0);
const wrongAtEnd = computed(
  () => wrongIndex.value >= wrongItems.value.length - 1,
);

/** 点错题卡：朗读单词（孩子复习的是这个字母对应的单词） */
function sayWrong(item: KidLetter) {
  sayWord(item);
}

/** 错题本翻页；已在两端返回 false */
function wrongStep(delta: number) {
  const target = wrongIndex.value + delta;
  if (target < 0 || target >= wrongItems.value.length) return false;
  wrongIndex.value = target;
  return true;
}

/** 错题本里「记住了」→ 移出错题本 */
function gotIt() {
  const item = wrongCurrent.value;
  const child = childId.value;
  if (!item || !child) return;
  kidStore.removeWrong(child, MODULE, item.letter);
  if (wrongItems.value.length === 0) {
    mode.value = 'learn';
    return;
  }
  // 移出后当前位置已经换成下一条；删的是最后一条时退回末尾
  if (wrongIndex.value >= wrongItems.value.length) {
    wrongIndex.value = wrongItems.value.length - 1;
  }
}

// ---------- 考一考：选择题卡片，手动翻页 ----------
interface QuizCard {
  /** 正确答案 */
  answer: string;
  /** 选项 */
  options: string[];
  /** 错题本条目标识（认单词时仍记字母，方便按字母复习） */
  itemId: string;
  /** 题目类型：认字母 或 认单词释义 */
  mode: 'letter' | 'word';
  /** 题干英文单词（认单词时读英文发音用） */
  word: string;
  /** 是否已答对（答对后锁定，翻回不再判分） */
  solved: boolean;
}

const quizCards = ref<QuizCard[]>([]);
const quizIndex = ref(0);

const quizCurrent = computed(() => quizCards.value[quizIndex.value]);
const quizAtStart = computed(() => quizIndex.value <= 0);
const quizAtEnd = computed(() => quizIndex.value >= quizCards.value.length - 1);

/** 生成一组固定题目（随机顺序），支持「上一个/下一个」回看 */
function buildQuiz() {
  quizCards.value = Array.from({ length: letters.value.length }, () => {
    const created = createQuiz();
    return {
      answer: created.answer,
      itemId: created.itemId,
      mode: created.mode,
      options: created.options,
      word: created.word,
      solved: false,
    };
  });
  quizIndex.value = 0;
}

/** 点题干：朗读题目（认字母读字母音，认单词读英文发音，不泄露答案） */
function sayPrompt() {
  const card = quizCurrent.value;
  if (!card) return;
  if (card.mode === 'letter') {
    speak($t('kid.tts.lettersQuiz', { letter: card.itemId }));
    return;
  }
  speak(card.word, { lang: 'en-US' });
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

/** 考一考翻页；已在两端返回 false */
function quizStep(delta: number) {
  const target = quizIndex.value + delta;
  if (target < 0 || target >= quizCards.value.length) return false;
  quizIndex.value = target;
  return true;
}

/**
 * 认字母：itemId = 字母，可从题库反查单词，不存 detail；
 * 认单词：itemId = `w-字母` 是带前缀的临时标识，无法反查，保留 detail 快照。
 */
function markLearned(key: string, detail?: string) {
  if (learned.value.includes(key)) return;
  learned.value = [...learned.value, key];
  reward({ detail, itemId: key, module: MODULE, praise: false });
}

/** 点字母卡：翻面看小写，同时读一遍 */
function tapLetterCard(item: KidLetter) {
  flipped.value = !flipped.value;
  sayLetter(item);
  markLearned(item.letter);
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
  } else if (key === 'quiz') {
    buildQuiz();
  } else {
    // 错题本：从头开始复习
    wrongIndex.value = 0;
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
        class="h-[52vh] min-h-[260px] w-full max-w-xl [perspective:1200px]"
        data-star-anchor
        @click="tapLetterCard(current)"
      >
        <span
          class="relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
          :class="{ '[transform:rotateY(180deg)]': flipped }"
        >
          <span
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-lg backdrop-blur-xl [backface-visibility:hidden] sm:p-10"
          >
            <span
              class="absolute left-4 top-4 text-3xl leading-none sm:left-8 sm:top-8 sm:text-4xl"
            >
              {{ current.emoji }}
            </span>
            <span
              class="text-[clamp(4.5rem,22vw,10rem)] leading-none font-black text-sky-500"
            >
              {{ current.letter }}
            </span>
            <span
              class="absolute bottom-4 left-1/2 -translate-x-1/2 text-lg text-kid-ink-soft sm:bottom-6 sm:text-xl"
            >
              {{ $t('kid.cards.tapHint') }} 👆
            </span>
          </span>

          <span
            class="absolute inset-0 flex items-center justify-center rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-lg backdrop-blur-xl [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-10"
          >
            <span
              class="text-[clamp(4.5rem,22vw,10rem)] leading-none font-black text-sky-300"
            >
              {{ current.lower }}
            </span>
          </span>
        </span>
      </button>

      <!-- 学单词：单词是主角，图案退成提示 -->
      <KidFlashCard
        v-else
        :hint="$t('kid.cards.tapHint')"
        @tap="tapWord(current)"
      >
        <span
          class="absolute left-4 top-4 text-[clamp(2rem,7vw,3rem)] leading-none sm:left-8 sm:top-8"
        >
          {{ current.emoji }}
        </span>
        <span
          class="text-[clamp(2.25rem,8vw,3.75rem)] font-black break-all text-sky-600"
        >
          {{ current.word }}
        </span>
        <span class="text-2xl font-bold text-slate-600 sm:text-3xl">
          {{ current.zh }}
        </span>
        <span class="text-base text-slate-400 sm:text-lg">
          {{ current.sentence }}
        </span>
      </KidFlashCard>

      <KidPager
        accent="sky"
        :at-end="atEnd"
        :at-start="atStart"
        :current="index"
        :total="total"
        @next="next()"
        @prev="prev()"
      >
        <template #prev>{{ $t('kid.letters.prev') }}</template>
        <template #next>{{ $t('kid.letters.next') }}</template>
      </KidPager>
    </template>

    <!-- 考一考：选择题，点选项判分，上一个/下一个翻页 -->
    <template v-else-if="mode === 'quiz' && quizCurrent">
      <!-- 题干：点一下朗读题目 -->
      <button
        class="mb-6 flex items-center gap-4 sm:mb-8"
        data-star-anchor
        type="button"
        @click="sayPrompt"
      >
        <span
          class="text-center text-2xl font-black text-slate-700 sm:text-4xl"
        >
          {{
            quizCurrent.mode === 'letter'
              ? $t('kid.letters.quizPrompt', { letter: quizCurrent.itemId })
              : $t('kid.letters.wordQuizPrompt', { word: quizCurrent.word })
          }}
        </span>
      </button>

      <!-- 选项：点选判分，答对后锁定 -->
      <OptionGrid
        active-class="text-sky-500"
        :options="quizCurrent.options"
        @pick="answerCard"
      />

      <KidPager
        class="mt-8"
        accent="sky"
        :at-end="quizAtEnd"
        :at-start="quizAtStart"
        :current="quizIndex"
        :total="quizCards.length"
        @next="quizStep(1)"
        @prev="quizStep(-1)"
      >
        <template #prev>{{ $t('kid.letters.prev') }}</template>
        <template #next>{{ $t('kid.letters.next') }}</template>
      </KidPager>
    </template>

    <!-- 错题本：裸大字复习 + 记住了移出 -->
    <template v-else-if="mode === 'wrongs' && wrongCurrent">
      <button
        class="mb-6 flex flex-wrap items-center justify-center gap-2 sm:mb-8 sm:gap-4"
        data-star-anchor
        type="button"
        @click="sayWrong(wrongCurrent)"
      >
        <span class="text-4xl sm:text-6xl">{{ wrongCurrent.emoji }}</span>
        <span class="text-[clamp(3rem,14vw,6rem)] font-black text-sky-500">
          {{ wrongCurrent.letter }}
        </span>
        <span class="text-4xl font-black text-sky-600 sm:text-6xl">
          {{ wrongCurrent.word }}
        </span>
        <span class="text-2xl font-bold text-slate-600 sm:text-4xl">
          {{ wrongCurrent.zh }}
        </span>
      </button>

      <KidPager
        accent="sky"
        :at-end="wrongAtEnd"
        :at-start="wrongAtStart"
        :current="wrongIndex"
        :total="wrongItems.length"
        @next="wrongStep(1)"
        @prev="wrongStep(-1)"
      >
        <template #prev>{{ $t('kid.letters.prev') }}</template>
        <template #next>{{ $t('kid.letters.next') }}</template>
      </KidPager>

      <div
        class="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6"
      >
        <button
          class="min-h-16 rounded-full bg-emerald-400 px-6 text-xl font-bold text-white shadow transition active:scale-90 sm:px-8 sm:text-2xl"
          @click="gotIt"
        >
          ✓ {{ $t('kid.letters.gotIt') }}
        </button>
      </div>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
