<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import ProgressDots from '../components/progress-dots.vue';
import StarToast from '../components/star-toast.vue';
import { useCardSession } from '../hooks/use-card-session';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';

const route = useRoute();
const router = useRouter();
const { bound } = useCurrentChild();
const { rewardBadges, rewardShow, rewardText } = useReward();
const { cardsByCategory, categories } = useContent();

const categoryId = computed(
  () => route.params.categoryId as string | undefined,
);
const { cards, current, inCategoryView, index, next, tapCard } = useCardSession(
  () => categoryId.value,
);

/** 进入分类；分类名是内容层中文素材，固定中文语音朗读 */
function openCategory(id: string, name: string) {
  router.push(`/kid/cards/${id}`);
  speak(name, { lang: CONTENT_TTS_LANG });
}

function backToCategories() {
  router.push('/kid/cards');
}
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else title-key="kid.modules.cards" emoji="🧐">
    <!-- 分类选择 -->
    <div
      v-if="inCategoryView"
      class="grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3"
    >
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 active:scale-95"
        @click="openCategory(cat.id, cat.name)"
      >
        <span
          class="flex h-24 w-24 items-center justify-center rounded-full text-6xl"
          :style="{ backgroundColor: `${cat.color}22` }"
        >
          {{ cat.emoji }}
        </span>
        <span class="text-2xl font-bold text-slate-700">{{ cat.name }}</span>
        <span class="text-base text-slate-400">
          {{ $t('kid.cards.count', { count: cardsByCategory(cat.id).length }) }}
        </span>
      </button>
    </div>

    <!-- 卡片学习 -->
    <template v-else-if="current">
      <ProgressDots :current="index" :total="cards.length" />

      <button
        class="flex min-h-[45vh] w-full max-w-xl flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-10 shadow-2xl transition active:scale-95"
        @click="tapCard"
      >
        <span class="text-[9rem] leading-none">{{ current.emoji }}</span>
        <span class="text-5xl font-black text-slate-700">{{
          current.name
        }}</span>
        <span class="text-2xl text-amber-500">{{ current.pinyin }}</span>
        <span class="text-xl text-slate-400">
          {{ $t('kid.cards.tapHint') }} 👆
        </span>
      </button>

      <button
        class="mt-8 rounded-full bg-orange-400 px-14 py-4 text-3xl font-bold text-white shadow-lg transition active:scale-95"
        @click="next() && backToCategories()"
      >
        {{ $t('kid.cards.next') }} →
      </button>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
