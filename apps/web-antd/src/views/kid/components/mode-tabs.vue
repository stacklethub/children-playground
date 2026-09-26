<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    activeClass?: string;
    labels: { learn: string; quiz: string };
  }>(),
  { activeClass: 'bg-sky-400' },
);

const emit = defineEmits<{ change: [mode: 'learn' | 'quiz'] }>();

const mode = defineModel<'learn' | 'quiz'>('mode', { default: 'learn' });

const options = computed(() => [
  { label: props.labels.learn, value: 'learn' as const },
  { label: props.labels.quiz, value: 'quiz' as const },
]);

function pick(value: 'learn' | 'quiz') {
  mode.value = value;
  emit('change', value);
}
</script>

<template>
  <div class="mb-8 flex gap-4 rounded-full bg-white/70 p-2">
    <button
      v-for="option in options"
      :key="option.value"
      class="rounded-full px-10 py-3 text-2xl font-bold transition"
      :class="
        mode === option.value
          ? `${activeClass} text-white shadow`
          : 'text-slate-500'
      "
      @click="pick(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
