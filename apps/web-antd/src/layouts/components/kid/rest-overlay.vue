<script lang="ts" setup>
import { $t } from '#/locales';

/** 护眼休息全屏提醒 */
const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{ finish: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-emerald-100"
  >
    <div class="text-8xl">🌳</div>
    <p class="text-3xl font-bold text-emerald-800">
      {{ $t('kid.rest.title') }}
    </p>
    <p class="text-xl text-emerald-600">{{ $t('kid.rest.tip') }}</p>
    <button
      class="rounded-full bg-emerald-500 px-12 py-4 text-2xl font-bold text-white shadow-lg active:scale-95"
      @click="emit('finish')"
    >
      {{ $t('kid.rest.done') }}
    </button>
  </div>
</template>
