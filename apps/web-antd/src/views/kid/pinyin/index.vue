<script setup lang="ts">
import type { PinyinQuizState } from '../hooks/use-quiz';

import type { KidPinyin } from '#/data/content';
import type { LearnModule } from '#/store';

import { computed, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { pinyinOf, spellSoundOf } from '#/utils/pinyin';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { usePinyinPractice, useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'pinyin';

const { bound, childId } = useCurrentChild();
const { pinyinList } = useContent();
const kidStore = useKidStore();
const { guide, reward, rewardBadges, rewardShow, rewardText } = useReward();

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
/** 除考一考外共用同一张卡：学拼音与认汉字主次互换，错题本复用认汉字的样子 */
const isCardMode = computed(() => mode.value !== 'quiz');

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
    detail: item.hanzi,
    itemId: item.id,
    module: MODULE,
    praise: false,
  });
}

/** 翻页；已在两端返回 false，按钮会置灰 */
function step(delta: number) {
  const target = index.value + delta;
  if (target < 0 || target >= items.value.length) return false;
  index.value = target;
  say(current.value);
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
    guide('kid.tts.pinyinIntro');
    return;
  }
  // 移出后当前位置已经换成下一条；删的是最后一条时退回末尾
  if (index.value >= items.value.length) index.value = items.value.length - 1;
  markSeen();
}

// ---------- 考一考：看拼音选汉字 / 看汉字选拼音 ----------
const { createQuiz } = usePinyinPractice();
const meta = ref<PinyinQuizState>({
  answer: '',
  emoji: '',
  itemId: '',
  mode: 'pickHanzi',
  options: [],
  prompt: '',
});

const {
  next: nextQuiz,
  pick,
  quiz,
  quizCount,
} = useQuiz<string>({
  ask: () => {
    // 题干是汉字时读它（答案在选项里，不泄露）；题干是拼音时只能读问句 ——
    // 拼音字形交给中文语音会读成怪音，读例字又等于直接报答案
    speak(
      meta.value.mode === 'pickPinyin'
        ? $t('kid.pinyin.quizPickPinyin', { hanzi: meta.value.prompt })
        : $t('kid.pinyin.quizPickHanzi'),
      { lang: CONTENT_TTS_LANG },
    );
  },
  create: () => {
    const created = createQuiz();
    meta.value = created;
    return { answer: created.answer, options: created.options };
  },
  itemIdOf: () => meta.value.itemId,
  module: MODULE,
});

function onModeChange(key: string) {
  if (key === 'quiz') {
    nextQuiz();
    return;
  }
  // 错题本与全部内容是两份列表，索引不能直接沿用
  if (key === 'wrongs') index.value = 0;
  say(current.value);
  markSeen();
}

onMounted(() => {
  guide('kid.tts.pinyinIntro');
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
      <button
        class="relative flex min-h-[55vh] w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-8 shadow-lg transition active:scale-95"
        data-star-anchor
        @click="say(current)"
      >
        <span class="absolute left-8 top-8 text-6xl">{{ current.emoji }}</span>
        <template v-if="mode === 'learn'">
          <span
            class="font-black leading-none text-rose-500"
            style="font-size: calc(13vw * 1.2)"
          >
            {{ current.pinyin }}
          </span>
          <span class="text-5xl font-black text-slate-700">
            {{ current.hanzi }}
          </span>
        </template>
        <template v-else>
          <span class="text-8xl font-black text-slate-700">
            {{ current.hanzi }}
          </span>
          <span class="text-5xl font-black text-rose-400">
            {{ pinyinOf(current.hanzi) }}
          </span>
        </template>
      </button>

      <nav class="mt-6 flex items-center gap-6">
        <button
          class="rounded-full bg-white/90 px-8 py-4 text-2xl font-bold text-slate-600 shadow transition active:scale-95 disabled:opacity-40"
          :disabled="atStart"
          @click="step(-1)"
        >
          ← {{ $t('kid.pinyin.prev') }}
        </button>
        <span class="text-2xl font-bold text-slate-600">
          {{ index + 1 }} / {{ items.length }}
        </span>
        <button
          class="rounded-full bg-rose-400 px-8 py-4 text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40"
          :disabled="atEnd"
          @click="step(1)"
        >
          {{ $t('kid.pinyin.next') }} →
        </button>
      </nav>

      <!-- 学拼音下点卡片就是重念，再摆一个「再听一次」是重复的 -->
      <div
        v-if="mode !== 'learn'"
        class="mt-6 flex flex-wrap items-center justify-center gap-6"
      >
        <button
          class="min-h-16 rounded-full bg-white/90 px-8 text-2xl font-bold text-slate-600 shadow transition active:scale-90"
          @click="say(current)"
        >
          🔊 {{ $t('kid.pinyin.replay') }}
        </button>
        <button
          v-if="mode === 'wrongs'"
          class="min-h-16 rounded-full bg-emerald-400 px-8 text-2xl font-bold text-white shadow transition active:scale-90"
          @click="gotIt"
        >
          ✓ {{ $t('kid.pinyin.gotIt') }}
        </button>
      </div>
    </template>

    <!-- 考一考 -->
    <template v-else-if="mode === 'quiz' && quiz && quiz.options.length > 0">
      <p class="mb-6 text-center text-3xl font-bold text-slate-600">
        {{
          meta.mode === 'pickPinyin'
            ? $t('kid.pinyin.quizPickPinyin', { hanzi: meta.prompt })
            : $t('kid.pinyin.quizPickHanzi')
        }}
      </p>
      <div
        class="relative mb-8 flex flex-col items-center gap-2 rounded-[3rem] bg-white/95 px-16 py-8 shadow-xl"
        data-star-anchor
      >
        <span class="absolute left-6 top-6 text-4xl">{{ meta.emoji }}</span>
        <!-- 题干是汉字时放大；是完整拼音时字多，得收一号才放得下 -->
        <span
          class="max-w-full break-words text-center font-black text-rose-500"
          :class="
            meta.mode === 'pickPinyin' ? 'text-7xl' : 'text-4xl sm:text-5xl'
          "
        >
          {{ meta.prompt }}
        </span>
      </div>
      <OptionGrid
        active-class="text-rose-500"
        :options="quiz.options"
        @pick="pick"
      />
      <p class="mt-8 text-xl text-slate-400">
        {{ $t('kid.pinyin.questionNo', { n: quizCount }) }}
      </p>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
