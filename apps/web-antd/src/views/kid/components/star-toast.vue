<script setup lang="ts">
defineProps<{
  show: boolean;
  text?: string;
  badges?: { emoji: string; name: string }[];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="star-fade">
      <div
        v-if="show"
        class="pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center"
      >
        <div class="star-pop text-[7rem] leading-none">⭐</div>
        <div class="mt-2 text-4xl font-black text-amber-500 drop-shadow">
          {{ text ?? '+1' }}
        </div>
        <div
          v-for="(badge, i) in badges ?? []"
          :key="badge.name"
          class="mt-4 flex items-center gap-2 rounded-full bg-white/90 px-6 py-3 text-2xl font-bold text-amber-600 shadow-lg"
          :style="{ animationDelay: `${i * 0.3}s` }"
          :class="['star-pop']"
        >
          <span class="text-3xl">{{ badge.emoji }}</span>
          获得徽章「{{ badge.name }}」
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.star-pop {
  animation: star-pop 1.1s ease-out forwards;
}
@keyframes star-pop {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-20deg);
  }
  40% {
    opacity: 1;
    transform: scale(1.2) rotate(8deg);
  }
  70% {
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
.star-fade-leave-active {
  transition: opacity 0.5s ease;
}
.star-fade-leave-to {
  opacity: 0;
}
</style>
