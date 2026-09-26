<script setup lang="ts">
import type { KidPoem } from '#/data/content';
import type { LearnModule } from '#/store';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
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

const index = ref(0);
const activeLine = ref(0);
const playing = ref(false);
/** 本次会话已听过的诗，用于去重计星 */
const learned = ref<string[]>([]);

const current = computed<KidPoem | undefined>(() => poems.value[index.value]);
const total = computed(() => poems.value.length);
const atStart = computed(() => index.value <= 0);
const atEnd = computed(() => index.value >= total.value - 1);

/**
 * 逐句链式朗读：一句读完自动念下一句。
 * `playing` 既是停止开关，也防止 stopSpeak 触发的 onEnd 把朗读续下去。
 */
function readFrom(from: number) {
  const poem = current.value;
  if (!poem) return;
  const line = poem.lines[from];
  if (line === undefined) {
    playing.value = false;
    return;
  }
  activeLine.value = from;
  playing.value = true;
  speak(line, {
    lang: CONTENT_TTS_LANG,
    onEnd: () => {
      if (playing.value) readFrom(from + 1);
    },
  });
}

/** 开读当前这首：计星 + 从头逐句朗读 */
function startPoem() {
  const poem = current.value;
  if (!poem) return;
  stopSpeak();
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

/** 翻到上/下一首；已在两端返回 false，按钮会置灰 */
function step(delta: number) {
  const target = index.value + delta;
  if (target < 0 || target >= total.value) return false;
  playing.value = false;
  index.value = target;
  startPoem();
  return true;
}

/** 点某一句，单独重念这一句 */
function tapLine(lineIndex: number) {
  stopSpeak();
  playing.value = false;
  activeLine.value = lineIndex;
  const line = current.value?.lines[lineIndex];
  if (line) speak(line, { lang: CONTENT_TTS_LANG });
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
    <!-- 一进来就是一首诗，左右翻页换诗 -->
    <template v-if="current">
      <div
        class="relative flex min-h-[50vh] w-full max-w-4xl flex-col items-center justify-center gap-3 rounded-[3rem] bg-white/95 p-6 shadow-2xl"
        data-star-anchor
      >
        <span class="absolute left-8 top-8 text-4xl">{{ current.emoji }}</span>
        <h2 class="text-4xl font-black text-lime-600">{{ current.title }}</h2>
        <p class="text-xl text-slate-400">{{ current.author }}</p>

        <div class="mt-2 flex flex-col items-center gap-2">
          <button
            v-for="(line, lineIndex) in current.lines"
            :key="lineIndex"
            class="min-h-14 rounded-2xl px-6 text-4xl font-black leading-relaxed transition"
            :class="
              lineIndex === activeLine
                ? 'bg-lime-200 text-lime-800'
                : 'text-slate-700'
            "
            @click="tapLine(lineIndex)"
          >
            {{ line }}
          </button>
        </div>
      </div>

      <button
        class="mt-4 min-h-14 rounded-full bg-lime-500 px-8 text-2xl font-bold text-white shadow transition active:scale-90"
        @click="startPoem"
      >
        🔊 {{ $t('kid.poems.readAll') }}
      </button>

      <nav class="mt-4 flex items-center gap-6">
        <button
          class="rounded-full bg-white/90 px-8 py-4 text-2xl font-bold text-slate-600 shadow transition active:scale-95 disabled:opacity-40"
          :disabled="atStart"
          @click="step(-1)"
        >
          ← {{ $t('kid.poems.prev') }}
        </button>
        <span class="text-2xl font-bold text-slate-600">
          {{ index + 1 }} / {{ total }}
        </span>
        <button
          class="rounded-full bg-lime-500 px-8 py-4 text-2xl font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-40"
          :disabled="atEnd"
          @click="step(1)"
        >
          {{ $t('kid.poems.next') }} →
        </button>
      </nav>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
