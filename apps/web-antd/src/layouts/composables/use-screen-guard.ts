import { onMounted, onUnmounted, ref } from 'vue';

import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { speak, stopSpeak } from '#/utils/tts';

/**
 * 护眼时长守卫：连续使用超过家长设定的分钟数后弹出休息提醒。
 */
export function useScreenGuard() {
  const kidStore = useKidStore();
  const resting = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  const startedAt = Date.now();

  function check() {
    const elapsedMin = (Date.now() - startedAt) / 60_000;
    if (elapsedMin >= kidStore.screenLimitMin) {
      resting.value = true;
      speak($t('kid.tts.rest'));
    }
  }

  function start() {
    timer = setInterval(check, 30_000);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  /** 休息结束，重新计时 */
  function finishRest() {
    resting.value = false;
    stop();
    start();
  }

  onMounted(start);
  onUnmounted(() => {
    stop();
    stopSpeak();
  });

  return { finishRest, resting };
}
