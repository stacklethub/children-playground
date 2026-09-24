<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useContent } from '#/data/use-content';
import { speak } from '#/utils/tts';

import StarToast from '../components/star-toast.vue';
import { useReward } from '../hooks/use-reward';

const route = useRoute();
const router = useRouter();
const { categories, cardsByCategory } = useContent();
const { guide, reward, rewardShow, rewardText, rewardBadges } = useReward();

/** 当前选中的分类（路由参数） */
const categoryId = computed(() => route.params.categoryId as string | undefined);
const cards = computed(() =>
  categoryId.value ? cardsByCategory(categoryId.value) : [],
);

/** 分类视图 */
const categoryView = computed(() => !categoryId.value);

/** 卡片浏览进度 */
const index = ref(0);
const current = computed(() => cards.value[index.value]);

/** 本次会话已学过的卡片（去重计星） */
const learnedIds = new Set<string>();

function tapCard() {
  if (!current.value) return;
  const card = current.value;
  speak(`${card.name}，${card.pinyin}。${card.fact ?? ''}`);
  if (!learnedIds.has(card.id)) {
    learnedIds.add(card.id);
    reward({
      detail: card.name,
      itemId: card.id,
      module: 'cards',
      praise: false,
      stars: 1,
    });
  }
}

function next() {
  if (index.value < cards.value.length - 1) {
    index.value += 1;
    speak('看一看，这是什么呀？');
  } else {
    speak('这个分类全部学完啦，你真棒！');
    router.push('/kid/cards');
  }
}

watch(categoryId, () => {
  index.value = 0;
  if (categoryId.value) {
    const cat = categories.value.find((c) => c.id === categoryId.value);
    if (cat) speak(`我们一起来认识${cat.name}吧！`);
  }
});

onMounted(() => {
  guide('点一点卡片，听听它是什么？');
});
</script>

<template>
  <div class="flex flex-1 flex-col items-center px-6 pb-28 pt-10">
    <!-- 分类选择 -->
    <template v-if="categoryView">
      <h1 class="mb-8 text-4xl font-black text-slate-700">看图识物 🧐</h1>
      <div class="grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 active:scale-95"
          @click="
            router.push(`/kid/cards/${cat.id}`);
            speak(cat.name);
          "
        >
          <span
            class="flex h-24 w-24 items-center justify-center rounded-full text-6xl"
            :style="{ backgroundColor: `${cat.color}22` }"
          >
            {{ cat.emoji }}
          </span>
          <span class="text-2xl font-bold text-slate-700">{{ cat.name }}</span>
          <span class="text-base text-slate-400">
            {{ cardsByCategory(cat.id).length }} 张卡片
          </span>
        </button>
      </div>
    </template>

    <!-- 卡片学习 -->
    <template v-else-if="current">
      <div class="mb-4 flex gap-2">
        <span
          v-for="(c, i) in cards"
          :key="c.id"
          class="h-2.5 w-2.5 rounded-full"
          :class="i <= index ? 'bg-amber-400' : 'bg-white/70'"
        ></span>
      </div>

      <button
        class="flex min-h-[45vh] w-full max-w-xl flex-col items-center justify-center gap-4 rounded-[3rem] bg-white/95 p-10 shadow-2xl transition active:scale-95"
        @click="tapCard"
      >
        <span class="text-[9rem] leading-none">{{ current.emoji }}</span>
        <span class="text-5xl font-black text-slate-700">
          {{ current.name }}
        </span>
        <span class="text-2xl text-amber-500">{{ current.pinyin }}</span>
        <span class="text-xl text-slate-400">点一点，听一听 👆</span>
      </button>

      <button
        class="mt-8 rounded-full bg-orange-400 px-14 py-4 text-3xl font-bold text-white shadow-lg transition active:scale-95"
        @click="next"
      >
        下一个 →
      </button>
    </template>

    <StarToast :show="rewardShow" :text="rewardText" :badges="rewardBadges" />
  </div>
</template>
