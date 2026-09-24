<script setup lang="ts">
import { ref } from 'vue';

import ParentGateModal from '#/layouts/components/kid/parent-gate-modal.vue';
import { $t } from '#/locales';

/**
 * 未绑定孩子时的引导页：宝宝端所有学习页在无绑定孩子时展示。
 */
const gateOpen = ref(false);
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center"
  >
    <span class="text-8xl">🧸</span>
    <h2 class="text-3xl font-bold text-slate-600">
      {{ $t('kid.guard.needBind') }}
    </h2>
    <p class="max-w-xl text-lg text-slate-400">
      {{ $t('kid.guard.bindTip') }}
    </p>
    <button
      class="rounded-full bg-slate-700 px-10 py-4 text-2xl font-bold text-white shadow-lg active:scale-95"
      @click="gateOpen = true"
    >
      {{ $t('kid.guard.openParent') }}
    </button>
    <ParentGateModal v-model:open="gateOpen" />
  </div>
</template>
