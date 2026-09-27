<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import LearnerSwitchModal from '#/layouts/components/kid/learner-switch-modal.vue';
import ParentGateModal from '#/layouts/components/kid/parent-gate-modal.vue';
import { useParentEntry } from '#/layouts/composables/use-parent-entry';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak } from '#/utils/tts';

import { useCurrentChild } from '../hooks/use-current-child';

/**
 * 宝宝端顶部 HUD：回学习岛 / 问候 / 星星数 / 家长入口。
 *
 * 它同时接管了原 KidCornerActions 的另外两个职责 —— 成人验证门禁与学习者切换。
 * 那两件事依赖 useParentEntry() 返回的一组状态，不能只搬按钮不搬 modal，
 * 否则「切换本机学习者」这个功能会静默消失。
 */
withDefaults(defineProps<{ showHome?: boolean }>(), { showHome: true });

const route = useRoute();
const router = useRouter();
const kidStore = useKidStore();
const { childId, childName } = useCurrentChild();

const {
  enterParentCenter,
  gateOpen,
  onGatePassed,
  openParentEntry,
  switchOpen,
} = useParentEntry();

const stars = computed(() =>
  childId.value ? kidStore.starsOf(childId.value) : 0,
);

function goHome() {
  if (route.name === 'KidHome') return;
  speak($t('kid.tts.backHome'));
  router.push({ name: 'KidHome' });
}

/** 右上角星星 → 「我的星星」：首页已移除 rewards 岛，入口收敛到 HUD 的星星上 */
function goRewards() {
  if (route.name === 'KidRewards') return;
  speak($t('kid.modules.rewards'));
  router.push({ name: 'KidRewards' });
}
</script>

<template>
  <!--
    relative z-10：首页的岛是 fixed 铺满视口的，定位元素会盖在普通流之上，
    HUD 必须自己抬起来才能浮在场景上方。

    移动端：三个按钮在 360px 宽的屏上会溢出，靠三件事收紧 ——
    间距/内边距随断点收缩、问候语用 min-w-0 + flex-1 允许截断、
    家长入口只留锁图标（文字在 sm 以上才出现）。
    **按钮的 min-h-16（64px）不能动**：3-5 岁手指落点精度低，这是硬要求。
  -->
  <header
    class="relative z-10 flex shrink-0 items-center gap-2 px-3 pt-3 sm:gap-3 sm:px-5 sm:pt-4"
  >
    <!-- 可点区域 ≥ 64px：3-5 岁手指落点精度低，这是硬要求 -->
    <button
      v-if="showHome"
      :title="$t('kid.action.backHome')"
      class="kid-hud-btn flex min-h-16 min-w-16 shrink-0 items-center justify-center rounded-full border border-white/60 bg-kid-sun/80 px-3 text-2xl text-kid-ink shadow-lg backdrop-blur-xl transition active:scale-95 sm:px-4"
      data-home
      type="button"
      @click="goHome"
    >
      🏠
    </button>

    <p
      class="min-w-0 flex-1 truncate text-lg font-black text-kid-ink sm:text-xl"
    >
      {{ $t('kid.home.greeting', { name: childName }) }}
    </p>

    <button
      :title="$t('kid.modules.rewards')"
      class="kid-hud-btn ml-auto flex min-h-16 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-3 text-lg font-black text-kid-berry shadow-lg backdrop-blur-xl transition active:scale-95 sm:gap-2 sm:px-5 sm:text-xl"
      type="button"
      @click="goRewards"
    >
      <svg aria-hidden="true" class="h-6 w-6 shrink-0" viewBox="0 0 24 24">
        <path
          d="M12 2.6l2.9 6.1 6.7 1-4.8 4.7 1.1 6.6L12 17.9 6.1 21l1.1-6.6L2.4 9.7l6.7-1Z"
          fill="#ffb100"
          stroke="#4a3f35"
          stroke-linejoin="round"
          stroke-width="1.8"
        />
      </svg>
      {{ stars }}
    </button>

    <button
      :title="$t('kid.gate.entry')"
      class="kid-hud-btn flex min-h-16 min-w-16 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/55 px-3 text-lg font-black text-kid-ink shadow-lg backdrop-blur-xl transition active:scale-95 sm:px-5"
      data-gate
      type="button"
      @click="openParentEntry"
    >
      🔒
      <span class="ml-1 hidden sm:inline">{{ $t('kid.gate.entry') }}</span>
    </button>

    <ParentGateModal v-model:open="gateOpen" @passed="onGatePassed" />
    <LearnerSwitchModal
      v-model:open="switchOpen"
      @enter-parent="enterParentCenter"
    />
  </header>
</template>
