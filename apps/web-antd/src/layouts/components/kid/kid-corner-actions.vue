<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import ParentGateModal from './parent-gate-modal.vue';

defineProps<{ showHome?: boolean }>();

const router = useRouter();
const gateOpen = defineModel<boolean>('gateOpen', { default: false });

function goHome() {
  speak($t('kid.tts.backHome'));
  router.push('/kid/home');
}
</script>

<template>
  <div>
    <!-- 回家按钮 -->
    <button
      v-if="showHome"
      :title="$t('kid.action.backHome')"
      class="fixed bottom-6 right-6 z-40 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-amber-400 text-4xl shadow-xl transition active:scale-90"
      @click="goHome"
    >
      🏠
    </button>

    <!-- 家长中心入口 -->
    <button
      :title="$t('kid.gate.entry')"
      class="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-700/60 text-xl text-white shadow-lg transition active:scale-90"
      @click="gateOpen = true"
    >
      🔒
    </button>

    <ParentGateModal v-model:open="gateOpen" />
  </div>
</template>
