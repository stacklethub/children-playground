import { ref } from 'vue';

import { useKidStore, type LearnModule } from '#/store';
import { speak, speakEncourage, speakPraise } from '#/utils/tts';

/**
 * 宝宝端奖励反馈：加星星 + 记录 + 星星动画 + 语音鼓励
 */
export function useReward() {
  const kidStore = useKidStore();
  const rewardShow = ref(false);
  const rewardText = ref('');
  const rewardBadges = ref<{ emoji: string; name: string }[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function showReward(n: number, badges: { emoji: string; name: string }[]) {
    rewardText.value = `+${n}`;
    rewardBadges.value = badges;
    rewardShow.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      rewardShow.value = false;
      rewardBadges.value = [];
    }, badges.length > 0 ? 2600 : 1300);
  }

  /** 答对/学会：加星星、写记录、朗读表扬 */
  function reward(options: {
    detail?: string;
    itemId: string;
    module: LearnModule;
    praise?: boolean;
    result?: 'learn' | 'right' | 'wrong';
    stars?: number;
  }) {
    const badges = kidStore.addStars(options.stars ?? 1);
    kidStore.addRecord({
      detail: options.detail,
      itemId: options.itemId,
      module: options.module,
      result: options.result ?? 'right',
    });
    showReward(options.stars ?? 1, badges);
    if (options.praise !== false) {
      speakPraise();
    }
  }

  /** 答错：不惩罚，语音鼓励 */
  function wrong() {
    speakEncourage();
  }

  /** 普通语音引导 */
  function guide(text: string) {
    speak(text);
  }

  return { guide, reward, rewardShow, rewardText, rewardBadges, wrong };
}
