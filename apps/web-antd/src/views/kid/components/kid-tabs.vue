<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    activeClass?: string;
    /** 页签项；key 交给调用方解释（如 'learn' / 'quiz' / 题型 key） */
    items: { emoji?: string; key: string; label: string }[];
  }>(),
  { activeClass: 'bg-sky-400' },
);

const emit = defineEmits<{ change: [key: string] }>();

/**
 * 通用页签：项数与语义由调用方决定。
 * 与 ModeTabs 的区别是它不把选项写死成「学一学 / 考一考」两项。
 */
const model = defineModel<string>('model');

const active = computed(() => model.value ?? props.items[0]?.key ?? '');

function pick(key: string) {
  model.value = key;
  emit('change', key);
}
</script>

<template>
  <div class="mb-8 flex flex-wrap gap-3 rounded-full bg-white/70 p-2">
    <button
      v-for="item in items"
      :key="item.key"
      class="min-h-20 rounded-full px-8 py-3 text-2xl font-bold transition"
      :class="
        active === item.key
          ? `${activeClass} text-white shadow`
          : 'text-slate-500'
      "
      @click="pick(item.key)"
    >
      <span v-if="item.emoji">{{ item.emoji }} </span>{{ item.label }}
    </button>
  </div>
</template>
