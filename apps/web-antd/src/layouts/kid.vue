<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterView, useRouter } from 'vue-router';

import { Input, Modal, message } from 'ant-design-vue';

import { speak, stopSpeak } from '#/utils/tts';
import { useKidStore } from '#/store';

/** 家长中心入口（需成人验证） */
const PARENT_HOME = '/parent/dashboard';

const router = useRouter();
const kidStore = useKidStore();

const showGate = ref(false);
const gateAnswer = ref('');
const gateQuestion = ref({ a: 0, b: 0 });

/** 是否在宝宝端首页（首页隐藏回家按钮） */
const isHome = computed(
  () => router.currentRoute.value.name === 'KidHome',
);

function openParentGate() {
  stopSpeak();
  gateQuestion.value = {
    a: 3 + Math.floor(Math.random() * 7),
    b: 4 + Math.floor(Math.random() * 6),
  };
  gateAnswer.value = '';
  showGate.value = true;
}

function confirmGate() {
  const { a, b } = gateQuestion.value;
  if (Number(gateAnswer.value) === a * b) {
    showGate.value = false;
    router.push(PARENT_HOME);
  } else {
    message.error('答案不对哦，请再试一次');
  }
}

/** 护眼提醒：单次使用超过设定时长弹出休息页 */
const resting = ref(false);
let screenTimer: undefined | ReturnType<typeof setInterval>;
const screenStart = Date.now();

function checkScreenTime() {
  const elapsedMin = (Date.now() - screenStart) / 60_000;
  if (elapsedMin >= kidStore.screenLimitMin) {
    resting.value = true;
    speak('小朋友，看了很久啦，让眼睛休息一下吧！');
  }
}

function finishRest() {
  resting.value = false;
  screenTimer = undefined;
  startScreenTimer();
}

function startScreenTimer() {
  screenTimer = setInterval(checkScreenTime, 30_000);
}

onMounted(() => {
  startScreenTimer();
  // 预热语音列表（Chrome 需要交互后才能拿到 voices）
  window.speechSynthesis?.getVoices?.();
});

onUnmounted(() => {
  if (screenTimer) clearInterval(screenTimer);
  stopSpeak();
});
</script>

<template>
  <div
    class="kid-layout relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-gradient-to-b from-sky-200 via-amber-50 to-rose-100"
  >
    <RouterView />

    <!-- 回家按钮 -->
    <button
      v-if="!isHome"
      class="fixed bottom-6 right-6 z-40 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-amber-400 text-4xl shadow-xl transition active:scale-90"
      title="回到学习岛"
      @click="router.push('/kid/home'); speak('回到学习岛')"
    >
      🏠
    </button>

    <!-- 家长入口 -->
    <button
      class="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-700/60 text-xl text-white shadow-lg transition active:scale-90"
      title="家长中心"
      @click="openParentGate"
    >
      🔒
    </button>

    <!-- 家长门禁 -->
    <Modal
      v-model:open="showGate"
      title="家长验证"
      :closable="true"
      :mask-closable="true"
      @ok="confirmGate"
    >
      <div class="py-2 text-base">
        请回答下面的问题，证明您是家长：
        <p class="my-3 text-2xl font-bold">
          {{ gateQuestion.a }} × {{ gateQuestion.b }} = ?
        </p>
        <Input
          v-model:value="gateAnswer"
          type="number"
          placeholder="请输入答案"
          @press-enter="confirmGate"
        />
      </div>
    </Modal>

    <!-- 护眼休息提醒 -->
    <div
      v-if="resting"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-emerald-100"
    >
      <div class="text-8xl">🌳</div>
      <p class="text-3xl font-bold text-emerald-800">小眼睛，休息一下吧！</p>
      <p class="text-xl text-emerald-600">看看远处的绿色，眨眨眼睛～</p>
      <button
        class="rounded-full bg-emerald-500 px-12 py-4 text-2xl font-bold text-white shadow-lg active:scale-95"
        @click="finishRest"
      >
        休息好啦
      </button>
    </div>
  </div>
</template>

<style scoped>
.kid-layout {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
