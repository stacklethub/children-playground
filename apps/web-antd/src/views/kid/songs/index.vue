<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';
import { useSongPlayer } from '../hooks/use-song-player';

const route = useRoute();
const router = useRouter();
const { bound } = useCurrentChild();
const { songs } = useContent();
const { rewardBadges, rewardShow, rewardText } = useReward();

const songId = computed(() => route.params.songId as string | undefined);
const song = computed(() => songs.value.find((s) => s.id === songId.value));
const { activeLine, play, speakLine, stop } = useSongPlayer(() => song.value);

/** 打开儿歌；标题是内容层中文素材，固定中文语音朗读 */
function openSong(id: string, title: string) {
  router.push(`/kid/songs/${id}`);
  speak(title, { lang: CONTENT_TTS_LANG });
}
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🎵" title-key="kid.modules.songs">
    <!-- 儿歌列表 -->
    <div
      v-if="!song"
      class="grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3"
    >
      <button
        v-for="item in songs"
        :key="item.id"
        class="flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 active:scale-95"
        data-star-anchor
        @click="openSong(item.id, item.title)"
      >
        <span
          class="flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-6xl"
        >
          {{ item.emoji }}
        </span>
        <span class="text-2xl font-bold text-slate-700">{{ item.title }}</span>
      </button>
    </div>

    <!-- 儿歌播放 -->
    <template v-else>
      <div
        class="flex w-full max-w-2xl flex-col gap-3 rounded-[2.5rem] bg-white/95 p-10 shadow-2xl"
        data-star-anchor
      >
        <p
          v-for="(line, i) in song.lines"
          :key="i"
          class="cursor-pointer rounded-2xl py-2 text-center text-3xl font-bold transition"
          :class="
            i === activeLine
              ? 'bg-violet-100 text-violet-600'
              : 'text-slate-600'
          "
          @click="speakLine(i)"
        >
          {{ line }}
        </p>
      </div>

      <div class="mt-8 flex gap-6">
        <button
          class="rounded-full bg-violet-400 px-14 py-4 text-3xl font-bold text-white shadow-lg transition active:scale-95"
          @click="
            stop();
            play();
          "
        >
          ▶️ {{ $t('kid.songs.play') }}
        </button>
        <button
          class="rounded-full bg-slate-300 px-10 py-4 text-3xl font-bold text-slate-600 shadow-lg transition active:scale-95"
          @click="
            stop();
            router.push('/kid/songs');
          "
        >
          {{ $t('kid.songs.switch') }}
        </button>
      </div>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
