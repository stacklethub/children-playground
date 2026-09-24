<script setup lang="ts">
import LearnerSwitchModal from '#/layouts/components/kid/learner-switch-modal.vue';
import ParentGateModal from '#/layouts/components/kid/parent-gate-modal.vue';
import { useParentEntry } from '#/layouts/composables/use-parent-entry';
import { $t } from '#/locales';

/**
 * 未选择学习者时的引导页：宝宝端所有学习页在「本设备无学习者」时展示。
 * 设备的学习者只能由家长显式选择，这里不会默认归属任何孩子。
 */
const {
  enterParentCenter,
  gateOpen,
  onGatePassed,
  openParentEntry,
  switchOpen,
} = useParentEntry();
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
      @click="openParentEntry"
    >
      {{ $t('kid.guard.openParent') }}
    </button>

    <ParentGateModal v-model:open="gateOpen" @passed="onGatePassed" />
    <LearnerSwitchModal
      v-model:open="switchOpen"
      @enter-parent="enterParentCenter"
    />
  </div>
</template>
