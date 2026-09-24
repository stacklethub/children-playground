<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useContent } from '#/data/use-content';
import { speak, stopSpeak } from '#/utils/tts';

import StarToast from '../components/star-toast.vue';
import { useReward } from '../hooks/use-reward';

const route = useRoute();
const router = useRouter();
const { songs } = useContent();
const { guide, reward, rewardShow, rewardText, rewardBadges } = useReward();

const songId = computed(() => route.params.songId as string | undefined);
const song = computed(() => songs.value.find((s) => s.id === songId.value));

/** 正在朗读的行下标（高亮） */
const activeLine = ref(-1);
/** 今天已经听过哪些儿歌（去重计星） */
const listenedToday = new Set<string>();

/** 逐行朗读儿歌 */
function play() {
  if (!song.value) return;
  const lines = song.value.lines;
  let i = 0;
  const speakLine = () => {
    if (i >= lines.length) {
      activeLine.value = -1;
      const today = new Date().toDateString();
      const key = `${song.value!.id}-${today}`;
      if (!listenedToday.has(key)) {
        listenedToday.add(key);
        reward({
          detail: song.value!.title,
          itemId: song.value!.id,
          module: 'songs',
          stars: 2,
        });
      } else {
        speak('唱完啦，还想再听一遍吗？');
      }
      return;
    }
    activeLine.value = i;
    speak(lines[i]!, { onEnd: () => { i += 1; speakLine(); } });
  };
  speakLine();
}

function stop() {
  stopSpeak();
  activeLine.value = -1;
}

onMounted(() => {
  if (!song.value) {
    guide('选一首喜欢的儿歌吧！');
  } else {
    play();
  }
});
</script>

<template>
  <div class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <!-- 儿歌列表 -->
    <template v-if="!song">
      <h1 class="mb-8 text-4xl font-black text-slate-700">儿歌点播 🎵</h1>
      <div class="grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
        <button
          v-for="s in songs"
          :key="s.id"
          class="flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 active:scale-95"
          @click="
            router.push(`/kid/songs/${s.id}`);
            speak(s.title);
          "
        >
          <span class="flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-6xl">
            {{ s.emoji }}
          </span>
          <span class="text-2xl font-bold text-slate-700">{{ s.title }}</span>
        </button>
      </div>
    </template>

    <!-- 儿歌播放 -->
    <template v-else>
      <div class="mb-6 flex items-center gap-4">
        <span class="text-6xl">{{ song.emoji }}</span>
        <h1 class="text-4xl font-black text-slate-700">{{ song.title }}</h1>
      </div>

      <div class="flex w-full max-w-2xl flex-col gap-3 rounded-[2.5rem] bg-white/95 p-10 shadow-2xl">
        <p
          v-for="(line, i) in song.lines"
          :key="i"
          class="cursor-pointer rounded-2xl py-2 text-center text-3xl font-bold transition"
          :class="i === activeLine ? 'bg-violet-100 text-violet-600' : 'text-slate-600'"
          @click="activeLine = i; speak(line)"
        >
          {{ line }}
        </p>
      </div>

      <div class="mt-8 flex gap-6">
        <button
          class="rounded-full bg-violet-400 px-14 py-4 text-3xl font-bold text-white shadow-lg transition active:scale-95"
          @click="stop(); play()"
        >
          ▶️ 一起唱
        </button>
        <button
          class="rounded-full bg-slate-300 px-10 py-4 text-3xl font-bold text-slate-600 shadow-lg transition active:scale-95"
          @click="stop(); router.push('/kid/songs')"
        >
          换一首
        </button>
      </div>
    </template>

    <StarToast :show="rewardShow" :text="rewardText" :badges="rewardBadges" />
  </div>
</template>
