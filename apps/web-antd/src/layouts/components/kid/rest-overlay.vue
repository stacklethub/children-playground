<script lang="ts" setup>
import { $t } from '#/locales';

const emit = defineEmits<{ finish: [] }>();

/** 护眼休息全屏提醒 */
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <div
    v-if="open"
    class="rest-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-emerald-100 px-6 text-center sm:gap-8"
  >
    <div class="text-6xl sm:text-8xl">🌳</div>
    <p class="text-2xl font-bold text-emerald-800 sm:text-3xl">
      {{ $t('kid.rest.title') }}
    </p>
    <p class="text-base text-emerald-600 sm:text-xl">
      {{ $t('kid.rest.tip') }}
    </p>
    <button
      class="min-h-16 rounded-full bg-emerald-500 px-8 text-xl font-bold text-white shadow-lg active:scale-95 sm:px-12 sm:text-2xl"
      @click="emit('finish')"
    >
      {{ $t('kid.rest.done') }}
    </button>
  </div>
</template>

<style scoped>
/*
 * fixed 定位不受 .kid-layout 的 padding 影响（它是相对视口定位的），
 * 所以这里必须自己让出刘海屏与手势条的安全区，否则「休息好了」按钮
 * 会压在手势条上、点不着。
 */
.rest-overlay {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
