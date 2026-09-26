<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import type { KidPinyin } from '#/data/content';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { type LearnModule, useKidStore } from '#/store';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidTabs from '../components/kid-tabs.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'pinyin';

const { bound, childId } = useCurrentChild();
const { pinyinList } = useContent();
const kidStore = useKidStore();
const { guide, reward, rewardBadges, rewardShow, rewardText } = useReward();

const mode = ref('learn');
const current = ref<KidPinyin>();
/** 未抽到的池子：抽走即不再出现，与 pinyin-vue 的「不重复出题」一致 */
const pool = ref<KidPinyin[]>([]);
/** 本次会话已朗读过的条目，用于去重计星 */
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

/** 错题本页签只在有错题时出现 */
const tabs = computed(() => {
  const items = [{ key: 'learn', label: $t('kid.pinyin.learn') }];
  if (wrongItems.value.length > 0) {
    items.push({
      key: 'wrongs',
      label: $t('kid.pinyin.wrongs', { n: wrongItems.value.length }),
    });
  }
  return items;
});

/**
 * 朗读例字而不是拼音字形：拼音是拉丁字母，中文语音会读成怪音
 * （见 utils/tts.ts 的 CONTENT_TTS_LANG 约定与卡片朗读的同类修复）。
 */
function say(item: KidPinyin | undefined) {
  if (!item) return;
  speak(item.hanzi, { lang: CONTENT_TTS_LANG });
}

function show(item: KidPinyin | undefined) {
  if (!item) return;
  current.value = item;
  say(item);
  if (learned.value.includes(item.id)) return;
  learned.value = [...learned.value, item.id];
  reward({
    detail: item.hanzi,
    itemId: item.id,
    module: MODULE,
    praise: false,
  });
}

/** 抽下一张；池子空了就重新洗牌 */
function draw() {
  if (pool.value.length === 0) {
    pool.value = [...pinyinList.value].sort(() => Math.random() - 0.5);
  }
  show(pool.value.shift());
}

/** 点按屏幕切下一个 */
function next() {
  if (mode.value !== 'wrongs') {
    draw();
    return;
  }
  const list = wrongItems.value;
  if (list.length === 0) return;
  const index = list.findIndex((item) => item.id === current.value?.id);
  show(list[(index + 1) % list.length]);
}

/** 错题复习里「记住了」→ 移出错题本 */
function gotIt() {
  const item = current.value;
  const child = childId.value;
  if (!item || !child) return;
  kidStore.removeWrong(child, MODULE, item.id);
  if (wrongItems.value.length === 0) {
    mode.value = 'learn';
    current.value = undefined;
    guide('kid.tts.pinyinIntro');
  } else {
    next();
  }
}

function onModeChange(key: string) {
  if (key === 'wrongs') {
    show(wrongItems.value[0]);
  } else {
    draw();
  }
}

onMounted(() => {
  guide('kid.tts.pinyinIntro');
  draw();
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🅰️" title-key="kid.modules.pinyin">
    <KidTabs
      v-model:model="mode"
      active-class="bg-rose-400"
      :items="tabs"
      @change="onModeChange"
    />

    <!-- 投屏大字：整屏一张，点按切下一个 -->
    <button
      class="flex min-h-[55vh] w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-8 shadow-lg transition active:scale-95"
      @click="next"
    >
      <span class="text-7xl">{{ current?.emoji }}</span>
      <span
        class="font-black leading-none text-rose-500"
        style="font-size: calc(13vw * 1.2)"
      >
        {{ current?.pinyin }}
      </span>
      <span class="text-6xl font-black text-slate-700">
        {{ current?.hanzi }}
      </span>
    </button>

    <div class="mt-6 flex flex-wrap items-center justify-center gap-6">
      <button
        class="min-h-20 rounded-full bg-white/90 px-8 text-2xl font-bold text-slate-600 shadow transition active:scale-90"
        @click.stop="say(current)"
      >
        🔊 {{ $t('kid.pinyin.replay') }}
      </button>
      <button
        v-if="mode === 'wrongs'"
        class="min-h-20 rounded-full bg-emerald-400 px-8 text-2xl font-bold text-white shadow transition active:scale-90"
        @click.stop="gotIt"
      >
        ✓ {{ $t('kid.pinyin.gotIt') }}
      </button>
    </div>

    <p class="mt-6 text-xl text-slate-400">
      {{
        $t('kid.pinyin.remaining', {
          n: mode === 'wrongs' ? wrongItems.length : pool.length,
        })
      }}
    </p>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
