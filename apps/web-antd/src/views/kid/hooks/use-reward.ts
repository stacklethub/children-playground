import { ref } from 'vue';

import { $t } from '#/locales';
import { useKidStore, type KidBadge, type LearnModule } from '#/store';
import { speak, speakEncourage, speakPraise } from '#/utils/tts';

import { useCurrentChild } from './use-current-child';

/**
 * 宝宝端奖励反馈：写入学习记录（星星随之累计）+ 星星动画 + 语音鼓励。
 * 未绑定孩子时不做任何记录（由页面引导家长绑定）。
 */
export function useReward() {
  const kidStore = useKidStore();
  const { childId, parentId } = useCurrentChild();

  const rewardShow = ref(false);
  const rewardText = ref('');
  const rewardBadges = ref<{ emoji: string; name: string }[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function showReward(stars: number, badges: KidBadge[]) {
    rewardText.value = `+${stars}`;
    rewardBadges.value = badges.map((b) => ({
      emoji: b.emoji,
      name: $t(`kid.badges.${b.key}.name`),
    }));
    rewardShow.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      rewardShow.value = false;
      rewardBadges.value = [];
    }, badges.length > 0 ? 2600 : 1300);
  }

  /** 学会/答对：记录 + 星星动画 +（可选）朗读表扬 */
  function reward(options: {
    detail?: string;
    itemId: string;
    module: LearnModule;
    praise?: boolean;
    result?: 'learn' | 'right' | 'wrong';
    stars?: number;
  }) {
    const stars = options.stars ?? 1;
    let badges: KidBadge[] = [];
    if (childId.value && parentId.value) {
      badges = kidStore.addRecord({
        childId: childId.value,
        detail: options.detail,
        itemId: options.itemId,
        module: options.module,
        parentId: parentId.value,
        result: options.result ?? 'right',
        stars,
      });
    }
    showReward(stars, badges);
    if (options.praise !== false) {
      speakPraise();
    }
  }

  /** 答错：不惩罚，语音鼓励 */
  function wrong() {
    speakEncourage();
  }

  /** 语音引导（文案走 i18n） */
  function guide(key: string, params?: Record<string, unknown>) {
    speak($t(key, params ?? {}));
  }

  return { guide, reward, rewardBadges, rewardShow, rewardText, wrong };
}
