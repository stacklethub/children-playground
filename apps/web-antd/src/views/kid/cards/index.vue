<script setup lang="ts">
import { $t } from '#/locales';

import BindGuard from '../components/bind-guard.vue';
import KidFlashCard from '../components/kid-flash-card.vue';
import KidPage from '../components/kid-page.vue';
import KidPager from '../components/kid-pager.vue';
import KidTabs from '../components/kid-tabs.vue';
import ProgressDots from '../components/progress-dots.vue';
import StarToast from '../components/star-toast.vue';
import { useCardSession } from '../hooks/use-card-session';
import { useCurrentChild } from '../hooks/use-current-child';
import { useReward } from '../hooks/use-reward';

const { bound } = useCurrentChild();
const { rewardBadges, rewardShow, rewardText } = useReward();

const {
  activeCategory,
  atEnd,
  atStart,
  cards,
  categoryTabs,
  current,
  index,
  pickCategory,
  step,
  tapCard,
} = useCardSession();
</script>

<template>
  <BindGuard v-if="!bound" />

  <KidPage v-else title-key="kid.modules.cards" emoji="🧐">
    <!-- 分类以顶部 Tab 胶囊展示，与其他模块二级切换方式一致 -->
    <KidTabs
      v-model="activeCategory"
      accent="apricot"
      :items="categoryTabs"
      @change="pickCategory"
    />

    <!-- 卡片学习 -->
    <template v-if="current">
      <ProgressDots :current="index" :total="cards.length" />

      <KidFlashCard :hint="$t('kid.cards.tapHint')" @tap="tapCard">
        <!--
          看图识物：图是主角居中，文字名称作辅助，拼音标注在汉字上方。
          三个字号都用 clamp 随屏宽收缩：text-9xl 固定 128px 在 360px 宽的
          手机上会把卡片撑破（emoji 本身、拼音、名称三行加起来超过卡片高度）。
        -->
        <span class="text-[clamp(4.5rem,20vw,8rem)] leading-none">
          {{ current.emoji }}
        </span>
        <span class="text-2xl text-amber-500 sm:text-3xl">
          {{ current.pinyin }}
        </span>
        <span class="text-[clamp(2rem,7vw,3rem)] font-black text-slate-700">
          {{ current.name }}
        </span>
      </KidFlashCard>

      <KidPager
        accent="apricot"
        :at-end="atEnd"
        :at-start="atStart"
        :current="index"
        :total="cards.length"
        @next="step(1)"
        @prev="step(-1)"
      >
        <template #prev>{{ $t('kid.cards.prev') }}</template>
        <template #next>{{ $t('kid.cards.next') }}</template>
      </KidPager>
    </template>

    <StarToast :badges="rewardBadges" :show="rewardShow" :text="rewardText" />
  </KidPage>
</template>
