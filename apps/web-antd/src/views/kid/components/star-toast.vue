<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

import { $t } from '#/locales';

const props = defineProps<{
  show: boolean;
  text?: string;
  badges?: { emoji: string; name: string }[];
}>();

/**
 * 奖励提示的落点。
 *
 * 页面用 `data-star-anchor` 标出卡片，星星贴到它的右上角 ——
 * 那里通常是空白，不会压住卡片正在展示的内容。
 *
 * 网格页一屏好几张卡片，所以要先记下**刚被点的那张**，
 * 直接取页面上第一个锚点会落到别的卡片上。没有标记的页面退回到顶部居中。
 */
const anchor = ref<{ left: number; top: number }>();
let lastAnchor: Element | null = null;

function rememberAnchor(event: Event) {
  const target = event.target;
  lastAnchor =
    target instanceof Element ? target.closest('[data-star-anchor]') : null;
}

function locate() {
  if (!props.show) return;
  // 卡片可能刚被 v-if 换掉，换成页面上仍存在的第一个锚点
  const el =
    (lastAnchor?.isConnected ? lastAnchor : null) ??
    document.querySelector('[data-star-anchor]');
  if (!el) {
    anchor.value = undefined;
    return;
  }
  const rect = el.getBoundingClientRect();
  anchor.value = { left: rect.right, top: rect.top };
}

onMounted(() => {
  document.addEventListener('pointerdown', rememberAnchor, true);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', rememberAnchor, true);
});

watch(() => props.show, locate);
</script>

<template>
  <Teleport to="body">
    <Transition name="star-fade">
      <div v-if="show" class="pointer-events-none fixed inset-0 z-[80]">
        <!-- 星星贴着卡片右上角；没有锚点的页面回退到顶部居中 -->
        <div
          class="absolute flex flex-col items-center"
          :class="
            anchor
              ? '-translate-x-1/2 -translate-y-1/2'
              : 'inset-x-0 top-0 pt-6'
          "
          :style="
            anchor
              ? { left: `${anchor.left}px`, top: `${anchor.top}px` }
              : undefined
          "
        >
          <div class="star-pop text-[4.5rem] leading-none">⭐</div>
          <div class="mt-1 text-3xl font-black text-amber-500 drop-shadow">
            {{ text ?? '+1' }}
          </div>
        </div>

        <!-- 徽章比星星宽得多，跟着跑去角落会在窄屏上被裁掉，单独贴顶居中 -->
        <div class="absolute inset-x-0 top-6 flex flex-col items-center gap-4">
          <div
            v-for="(badge, i) in badges ?? []"
            :key="badge.name"
            class="star-pop flex items-center gap-2 rounded-full bg-white/90 px-6 py-3 text-2xl font-bold text-amber-600 shadow-lg"
            :style="{ animationDelay: `${i * 0.3}s` }"
          >
            <span class="text-3xl">{{ badge.emoji }}</span>
            {{ $t('kid.badges.got', { name: badge.name }) }}
          </div>
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
