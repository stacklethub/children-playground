<script setup lang="ts">
import { onMounted } from 'vue';

import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import { useCurrentChild } from '../hooks/use-current-child';

const kidStore = useKidStore();
const { bound, childId, childName } = useCurrentChild();

onMounted(() => {
  if (bound.value) {
    speak($t('kid.tts.welcome', { name: childName.value }));
  }
});
</script>

<template>
  <BindGuard v-if="!bound" />

  <div
    v-else
    class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10"
  >
    <span class="text-7xl">🌈</span>
    <h1 class="text-4xl font-black text-slate-700">
      {{ $t('kid.home.greeting', { name: childName }) }}
    </h1>
    <span
      class="flex items-center gap-2 rounded-full bg-white/80 px-8 py-3 text-3xl font-bold text-amber-500 shadow"
    >
      ⭐ {{ kidStore.starsOf(childId) }}
    </span>
    <p class="text-2xl text-slate-500">{{ $t('kid.home.question') }}</p>
  </div>
</template>
