<script setup lang="ts">
import LearnerSwitchModal from '#/layouts/components/kid/learner-switch-modal.vue';
import ParentGateModal from '#/layouts/components/kid/parent-gate-modal.vue';
import { useParentEntry } from '#/layouts/composables/use-parent-entry';
import { $t } from '#/locales';

/**
 * 未选择学习者时的引导页：宝宝端所有学习页在「本设备无学习者」时展示。
 * 正常首次运行会预置默认孩子并绑定（见 `store/family.ts`），不会走到这里；
 * 只有在家长解绑本机学习者、或删除当前学习者之后才会出现，可在此通过
 * 家长门禁重新绑定。
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
    class="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center sm:gap-6 sm:px-8"
  >
    <span class="text-6xl sm:text-8xl">🧸</span>
    <h2 class="text-2xl font-bold text-slate-600 sm:text-3xl">
      {{ $t('kid.guard.needBind') }}
    </h2>
    <p class="max-w-xl text-base text-slate-400 sm:text-lg">
      {{ $t('kid.guard.bindTip') }}
    </p>
    <button
      class="min-h-16 rounded-full bg-slate-700 px-8 py-4 text-xl font-bold text-white shadow-lg active:scale-95 sm:px-10 sm:text-2xl"
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
