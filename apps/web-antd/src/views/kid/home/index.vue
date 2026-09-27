<script setup lang="ts">
import { onMounted } from 'vue';

import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import BindGuard from '../components/bind-guard.vue';
import KidIsland from '../components/kid-island.vue';
import { useCurrentChild } from '../hooks/use-current-child';

const { bound, childName } = useCurrentChild();

onMounted(() => {
  if (bound.value) {
    speak($t('kid.tts.welcome', { name: childName.value }));
  }
});
</script>

<template>
  <BindGuard v-if="!bound" />
  <!--
    岛就是首页的全部内容：问候语与星星数已上移到顶部 HUD，
    这里再放一遍会和 HUD 重复。
  -->
  <KidIsland v-else />
</template>
