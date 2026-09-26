<script setup lang="ts">
import type { LogicKind } from '#/data/content';
import type { LearnModule } from '#/store';

import { onMounted, ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidPage from '../components/kid-page.vue';
import KidTabs from '../components/kid-tabs.vue';
import OptionGrid from '../components/option-grid.vue';
import StarToast from '../components/star-toast.vue';
import { useCurrentChild } from '../hooks/use-current-child';
import { useQuiz } from '../hooks/use-quiz';
import { useReward } from '../hooks/use-reward';

const MODULE: LearnModule = 'logic';

const { bound } = useCurrentChild();
const { logicItems } = useContent();
const { guide, rewardBadges, rewardShow, rewardText } = useReward();

const kind = ref<LogicKind>('pattern');
/** 当前题的题干与条目 id（错题本按 id 记录） */
const meta = ref({ id: '', prompt: '' });

const tabs = [
  { label: $t('kid.logic.pattern'), value: 'pattern' },
  { label: $t('kid.logic.sort'), value: 'sort' },
  { label: $t('kid.logic.compare'), value: 'compare' },
  { label: $t('kid.logic.match'), value: 'match' },
];

const { next, pick, quiz, quizCount } = useQuiz<string>({
  ask: () => speak(meta.value.prompt, { lang: CONTENT_TTS_LANG }),
  create: () => {
    const pool = logicItems.value.filter((item) => item.kind === kind.value);
    // 家长可能把某个题型的题全删了；此时不出题，页面显示空态而不是报错
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!item) {
      meta.value = { id: '', prompt: '' };
      return { answer: '', options: [] };
    }
    meta.value = { id: item.id, prompt: item.prompt };
    return { answer: item.answer, options: [...item.options] };
  },
  itemIdOf: () => meta.value.id,
  module: MODULE,
});

function onKindChange() {
  next();
}

onMounted(() => {
  guide('kid.tts.logicIntro');
  next();
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else emoji="🧩" title-key="kid.modules.logic">
    <KidTabs v-model="kind" accent="sun" :items="tabs" @change="onKindChange" />

    <template v-if="quiz && quiz.options.length > 0">
      <p class="mb-8 text-center text-4xl font-black text-slate-700">
        {{ meta.prompt }}
      </p>
      <OptionGrid
        active-class="text-cyan-500"
        :options="quiz.options"
        @pick="pick"
      />
      <p class="mt-8 text-xl text-slate-400">
        {{ $t('kid.logic.questionNo', { n: quizCount }) }}
      </p>
    </template>

    <p v-else class="text-2xl text-slate-400">
      {{ $t('kid.logic.empty') }}
    </p>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
