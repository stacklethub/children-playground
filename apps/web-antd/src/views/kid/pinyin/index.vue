<script setup lang="ts">
import type { KidPinyin } from '#/data/content';
import type { LearnModule } from '#/store';

import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { pinyinOf, spellSoundOf } from '#/utils/pinyin';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidFlashCard from '../components/kid-flash-card.vue';
import KidPage from '../components/kid-page.vue';
import KidPager from '../components/kid-pager.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { usePinyinPractice } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'pinyin';

const { bound, childId } = useCurrentChild();
const { pinyinList } = useContent();
const kidStore = useKidStore();
const { reward, rewardBadges, rewardShow, rewardText, wrong } = useReward();

const mode = ref('learn');
const index = ref(0);
/** 本次会话已看过的条目，用于去重计星 */
const learned = ref<string[]>([]);

/** 错题本里的条目（按 itemId 映射回内容，孤儿项静默丢弃） */
const wrongItems = computed(() => {
  const child = childId.value;
  if (!child) return [];
  const byId = new Map(pinyinList.value.map((item) => [item.id, item]));
  return kidStore
    .wrongOf(child, MODULE)
    .map((w) => byId.get(w.itemId))
    .filter((item): item is KidPinyin => Boolean(item));
});

/** 当前模式要翻的列表：学拼音与认汉字用全部内容，错题本用错题 */
const items = computed(() =>
  mode.value === 'wrongs' ? wrongItems.value : pinyinList.value,
);
const current = computed(() => items.value[index.value]);
const atStart = computed(() => index.value <= 0);
const atEnd = computed(() => index.value >= items.value.length - 1);
/** 学拼音与认汉字共用同一张卡片，主次互换；错题本与考一考不走卡片 */
const isCardMode = computed(
  () => mode.value === 'learn' || mode.value === 'hanzi',
);

/** 错题本页签只在有错题时出现 */
const tabs = computed(() => {
  const list = [
    { label: $t('kid.pinyin.learn'), value: 'learn' },
    { label: $t('kid.pinyin.hanzi'), value: 'hanzi' },
    { label: $t('kid.pinyin.quiz'), value: 'quiz' },
  ];
  if (wrongItems.value.length > 0) {
    list.push({
      label: $t('kid.pinyin.wrongs', { n: wrongItems.value.length }),
      value: 'wrongs',
    });
  }
  return list;
});

/**
 * 学拼音读拼音的呼读音（「b」→「玻」）：拼音字形交给中文语音会念成英文字母音，
 * 改读例字又会把答案一起报出来。未收录的条目退回读例字兜底。
 *
 * 认汉字（含错题本）要读汉字本身 —— 孩子这时看的是字，
 * 念声母的呼读音他接不上，听着也像只读了一个字。
 */
function say(item: KidPinyin | undefined) {
  if (!item) return;
  const text =
    mode.value === 'learn'
      ? (spellSoundOf(item.pinyin) ?? item.hanzi)
      : item.hanzi;
  speak(text, { lang: CONTENT_TTS_LANG });
}

/** 翻到的条目计入星星（每条只计一次） */
function markSeen() {
  const item = current.value;
  if (!item || learned.value.includes(item.id)) return;
  learned.value = [...learned.value, item.id];
  reward({
    itemId: item.id,
    module: MODULE,
    praise: false,
  });
}

/** 翻页；已在两端返回 false，按钮会置灰。翻页不朗读（孩子点卡片/再听一次才出声） */
function step(delta: number) {
  const target = index.value + delta;
  if (target < 0 || target >= items.value.length) return false;
  index.value = target;
  markSeen();
  return true;
}

/** 错题复习里「记住了」→ 移出错题本 */
function gotIt() {
  const item = current.value;
  const child = childId.value;
  if (!item || !child) return;
  kidStore.removeWrong(child, MODULE, item.id);
  if (wrongItems.value.length === 0) {
    mode.value = 'learn';
    index.value = 0;
    return;
  }
  // 移出后当前位置已经换成下一条；删的是最后一条时退回末尾
  if (index.value >= items.value.length) index.value = items.value.length - 1;
  markSeen();
}

// ---------- 考一考：选择题卡片，手动翻页 ----------
interface QuizCard {
  /** 题干字形：显示拼音（考认字）或显示汉字（考认拼音） */
  prompt: string;
  /** 正确答案 */
  answer: string;
  /** 选项 */
  options: string[];
  /** 错题本条目标识 */
  itemId: string;
  mode: 'pickHanzi' | 'pickPinyin';
  emoji: string;
  /** 是否已答对（答对后锁定选项，翻回不再判分） */
  solved: boolean;
}

const { createQuiz } = usePinyinPractice();

const quizCards = ref<QuizCard[]>([]);
const quizIndex = ref(0);

const quizCurrent = computed(() => quizCards.value[quizIndex.value]);
const quizAtStart = computed(() => quizIndex.value <= 0);
const quizAtEnd = computed(() => quizIndex.value >= quizCards.value.length - 1);
/** 题干是汉字（考认拼音）还是拼音（考认字），决定字号与配色 */
const isHanziPrompt = computed(() => quizCurrent.value?.mode === 'pickPinyin');

/** 生成一组固定题目（随机顺序），支持「上一个/下一个」回看 */
function buildQuiz() {
  quizCards.value = pinyinList.value.map(() => {
    const q = createQuiz();
    return {
      answer: q.answer,
      emoji: q.emoji,
      itemId: q.itemId,
      mode: q.mode,
      options: q.options,
      prompt: q.prompt,
      solved: false,
    };
  });
  quizIndex.value = 0;
}

/** 点题干：朗读题目（题干是汉字读它，是拼音读问句，不泄露答案） */
function sayPrompt() {
  const card = quizCurrent.value;
  if (!card) return;
  speak(
    card.mode === 'pickPinyin'
      ? $t('kid.pinyin.quizPickPinyin', { hanzi: card.prompt })
      : $t('kid.pinyin.quizPickHanzi'),
    { lang: CONTENT_TTS_LANG },
  );
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

function onModeChange(key: string) {
  if (key === 'quiz') {
    buildQuiz();
    return;
  }
  // 错题本与全部内容是两份列表，索引不能直接沿用；切换页签不朗读
  if (key === 'wrongs') index.value = 0;
  markSeen();
}

onMounted(() => {
  // 初次进入不朗读，孩子点卡片 / 再听一次才出声
  markSeen();
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🅰️" title-key="kid.modules.pinyin">
    <KidTabs
      v-model="mode"
      accent="coral"
      :items="tabs"
      @change="onModeChange"
    />

    <!-- 学拼音 / 认汉字：投屏大字，翻页用下面的按钮（点卡片只是重念一遍） -->
    <template v-if="isCardMode && current">
      <KidFlashCard :hint="$t('kid.pinyin.tapHint')" @tap="say(current)">
        <span
          class="absolute left-4 top-4 text-4xl sm:left-8 sm:top-8 sm:text-6xl"
        >
          {{ current.emoji }}
        </span>
        <template v-if="mode === 'learn'">
          <span
            class="font-black leading-none text-rose-500"
            style="font-size: clamp(4rem, 13vw, 9rem)"
          >
            {{ current.pinyin }}
          </span>
          <span class="text-[clamp(2rem,7vw,3rem)] font-black text-slate-700">
            {{ current.hanzi }}
          </span>
        </template>
        <template v-else>
          <span class="text-[clamp(2rem,7vw,3rem)] font-black text-rose-400">
            {{ pinyinOf(current.hanzi) }}
          </span>
          <span class="text-[clamp(3rem,14vw,6rem)] font-black text-slate-700">
            {{ current.hanzi }}
          </span>
        </template>
      </KidFlashCard>

      <KidPager
        accent="coral"
        :at-end="atEnd"
        :at-start="atStart"
        :current="index"
        :total="items.length"
        @next="step(1)"
        @prev="step(-1)"
      >
        <template #prev>{{ $t('kid.pinyin.prev') }}</template>
        <template #next>{{ $t('kid.pinyin.next') }}</template>
      </KidPager>
    </template>

    <!-- 错题本：裸大字 + 记住了移出，不走卡片 -->
    <template v-else-if="mode === 'wrongs' && current">
      <button
        class="mb-6 flex flex-wrap items-center justify-center gap-2 sm:mb-8 sm:gap-4"
        data-star-anchor
        type="button"
        @click="say(current)"
      >
        <span class="text-4xl sm:text-6xl">{{ current.emoji }}</span>
        <span class="text-[clamp(2rem,7vw,3rem)] font-black text-rose-400">
          {{ pinyinOf(current.hanzi) }}
        </span>
        <span class="text-[clamp(3rem,14vw,6rem)] font-black text-slate-700">
          {{ current.hanzi }}
        </span>
      </button>

      <KidPager
        accent="coral"
        :at-end="atEnd"
        :at-start="atStart"
        :current="index"
        :total="items.length"
        @next="step(1)"
        @prev="step(-1)"
      >
        <template #prev>{{ $t('kid.pinyin.prev') }}</template>
        <template #next>{{ $t('kid.pinyin.next') }}</template>
      </KidPager>

      <div
        class="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6"
      >
        <button
          class="min-h-16 rounded-full bg-emerald-400 px-6 text-xl font-bold text-white shadow transition active:scale-90 sm:px-8 sm:text-2xl"
          @click="gotIt"
        >
          ✓ {{ $t('kid.pinyin.gotIt') }}
        </button>
      </div>
    </template>

    <!-- 考一考：题干大字 + 点选项判分，上一个/下一个翻页 -->
    <template v-else-if="mode === 'quiz' && quizCurrent">
      <!-- 题干：点一下朗读题目 -->
      <button
        class="mb-4 flex flex-wrap items-center justify-center gap-2 sm:mb-8 sm:gap-4"
        data-star-anchor
        type="button"
        @click="sayPrompt"
      >
        <span class="text-4xl sm:text-6xl">{{ quizCurrent.emoji }}</span>
        <!-- 题干：考认拼音时是汉字，考认字时是拼音 -->
        <span
          class="font-black leading-none"
          :class="
            isHanziPrompt
              ? 'text-[clamp(3rem,14vw,6rem)] text-slate-700'
              : 'text-[clamp(2.25rem,10vw,4.5rem)] text-rose-500'
          "
        >
          {{ quizCurrent.prompt }}
        </span>
      </button>

      <!-- 选项：点选判分，答对后锁定 -->
      <OptionGrid
        active-class="text-rose-500"
        :options="quizCurrent.options"
        @pick="answerCard"
      />

      <KidPager
        class="mt-8"
        accent="coral"
        :at-end="quizAtEnd"
        :at-start="quizAtStart"
        :current="quizIndex"
        :total="quizCards.length"
        @next="quizStep(1)"
        @prev="quizStep(-1)"
      >
        <template #prev>{{ $t('kid.pinyin.prev') }}</template>
        <template #next>{{ $t('kid.pinyin.next') }}</template>
      </KidPager>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
