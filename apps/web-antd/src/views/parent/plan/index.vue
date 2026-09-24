<script setup lang="ts">
import { reactive } from 'vue';

import { Button, Card, InputNumber, Slider, message } from 'ant-design-vue';

import { useKidStore, type LearnModule } from '#/store';

const kidStore = useKidStore();

const goals = reactive<Record<LearnModule, number>>({ ...kidStore.dailyGoals });

const MODULE_NAMES: Record<LearnModule, { emoji: string; name: string }> = {
  cards: { emoji: '🐘', name: '看图识物（次/天）' },
  letters: { emoji: '🔤', name: '字母乐园（次/天）' },
  numbers: { emoji: '🔢', name: '数字小屋（次/天）' },
  songs: { emoji: '🎵', name: '儿歌点播（首/天）' },
};

function save() {
  kidStore.dailyGoals = { ...goals };
  message.success('学习计划已保存');
}
</script>

<template>
  <div class="grid gap-5 p-5 lg:grid-cols-2">
    <Card title="每日学习目标">
      <div class="flex flex-col gap-5">
        <div
          v-for="key in Object.keys(MODULE_NAMES) as LearnModule[]"
          :key="key"
          class="flex items-center justify-between"
        >
          <span class="text-base">
            {{ MODULE_NAMES[key]!.emoji }} {{ MODULE_NAMES[key]!.name }}
          </span>
          <InputNumber
            v-model:value="goals[key]"
            :max="50"
            :min="1"
            style="width: 100px"
          />
        </div>
        <Button type="primary" @click="save">保存目标</Button>
      </div>
    </Card>

    <Card title="护眼与时长">
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-base">
            单次使用时长提醒（分钟），超过后宝宝端会弹出休息提醒
          </p>
          <Slider
            v-model:value="kidStore.screenLimitMin"
            :marks="{ 10: '10', 20: '20', 30: '30', 45: '45', 60: '60' }"
            :max="60"
            :min="10"
            :step="5"
          />
        </div>
        <p class="text-muted-foreground text-sm">
          建议 3-6 岁儿童单次使用电子屏幕不超过 20 分钟，每天累计不超过 1 小时。
        </p>
      </div>
    </Card>
  </div>
</template>
