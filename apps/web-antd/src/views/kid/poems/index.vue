<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import type { KidPoem } from '#/data/content';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { type LearnModule } from '#/store';
import { CONTENT_TTS_LANG, speak, stopSpeak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'poems';

const { bound } = useCurrentChild();
const { poems } = useContent();
const { guide, reward, rewardBadges, rewardShow, rewardText } = useReward();

const current = ref<KidPoem>();
const activeLine = ref(0);
const playing = ref(false);
/** 本次会话已听过的诗，用于去重计星 */
const learned = ref<string[]>([]);

/**
 * 逐句链式朗读：一句读完自动念下一句。
 * `playing` 既是停止开关，也防止 stopSpeak 触发的 onEnd 把朗读续下去。
 */
function readFrom(index: number) {
  const poem = current.value;
  if (!poem) return;
  const line = poem.lines[index];
  if (line === undefined) {
    playing.value = false;
    return;
  }
  activeLine.value = index;
  playing.value = true;
  speak(line, {
    lang: CONTENT_TTS_LANG,
    onEnd: () => {
      if (playing.value) readFrom(index + 1);
    },
  });
}

function open(poem: KidPoem) {
  current.value = poem;
  if (!learned.value.includes(poem.id)) {
    learned.value = [...learned.value, poem.id];
    reward({
      detail: poem.title,
      itemId: poem.id,
      module: MODULE,
      praise: false,
    });
  }
  readFrom(0);
}

/** 点某一句，单独重念这一句 */
function tapLine(index: number) {
  stopSpeak();
  playing.value = false;
  activeLine.value = index;
  const line = current.value?.lines[index];
  if (line) speak(line, { lang: CONTENT_TTS_LANG });
}

function back() {
  stopSpeak();
  playing.value = false;
  current.value = undefined;
}

onMounted(() => {
  guide('kid.tts.poemsIntro');
});

onBeforeUnmount(() => {
  playing.value = false;
  stopSpeak();
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="📜" title-key="kid.modules.poems">
    <!-- 诗单 -->
    <div
      v-if="!current"
      class="grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3"
    >
      <button
        v-for="poem in poems"
        :key="poem.id"
        class="flex min-h-32 flex-col items-center justify-center gap-1 rounded-3xl bg-white/95 p-5 shadow-md transition hover:-translate-y-1 active:scale-90"
        @click="open(poem)"
      >
        <span class="text-4xl">{{ poem.emoji }}</span>
        <span class="text-2xl font-black text-lime-600">{{ poem.title }}</span>
        <span class="text-base text-slate-400">{{ poem.author }}</span>
      </button>
    </div>

    <!-- 单诗：大字逐句朗读，不做答题 -->
    <div v-else class="flex w-full max-w-4xl flex-col items-center gap-5">
      <button
        class="min-h-20 rounded-full bg-white/90 px-8 text-2xl font-bold text-slate-600 shadow transition active:scale-90"
        @click="back"
      >
        ← {{ $t('kid.poems.back') }}
      </button>

      <span class="text-6xl">{{ current.emoji }}</span>
      <h2 class="text-4xl font-black text-lime-600">{{ current.title }}</h2>
      <p class="text-xl text-slate-400">{{ current.author }}</p>

      <div class="flex flex-col items-center gap-2">
        <button
          v-for="(line, index) in current.lines"
          :key="index"
          class="min-h-20 rounded-2xl px-6 text-4xl font-black leading-relaxed transition"
          :class="
            index === activeLine
              ? 'bg-lime-200 text-lime-800'
              : 'text-slate-700'
          "
          @click="tapLine(index)"
        >
          {{ line }}
        </button>
      </div>

      <button
        class="min-h-20 rounded-full bg-lime-500 px-8 text-2xl font-bold text-white shadow transition active:scale-90"
        @click="readFrom(0)"
      >
        🔊 {{ $t('kid.poems.readAll') }}
      </button>
    </div>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
