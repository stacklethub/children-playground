<script lang="ts" setup>
import { reactive } from 'vue';

import { Button, Card, InputNumber, Slider, message } from 'ant-design-vue';

import { $t } from '#/locales';
import { MODULE_KEYS, useKidStore, type LearnModule } from '#/store';

const kidStore = useKidStore();

const goals = reactive<Record<LearnModule, number>>({ ...kidStore.dailyGoals });

const MODULE_EMOJI: Record<LearnModule, string> = {
  cards: '🐘',
  letters: '🔤',
  numbers: '🔢',
  songs: '🎵',
};

function save() {
  kidStore.dailyGoals = { ...goals };
  message.success($t('parent.common.saved'));
}
</script>

<template>
  <div class="grid gap-5 p-5 lg:grid-cols-2">
    <Card :title="$t('parent.plan.title')">
      <div class="flex flex-col gap-5">
        <div
          v-for="module in MODULE_KEYS"
          :key="module"
          class="flex items-center justify-between"
        >
          <span class="text-base">
            {{ MODULE_EMOJI[module] }} {{ $t(`kid.modules.${module}`) }}
            （{{
              module === 'songs'
                ? $t('parent.plan.songUnit')
                : $t('parent.plan.unit')
            }}）
          </span>
          <InputNumber
            v-model:value="goals[module]"
            :max="50"
            :min="1"
            style="width: 100px"
          />
        </div>
        <Button type="primary" @click="save">
          {{ $t('parent.plan.save') }}
        </Button>
      </div>
    </Card>

    <Card :title="$t('parent.plan.screenTitle')">
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-base">{{ $t('parent.plan.screenLabel') }}</p>
          <Slider
            v-model:value="kidStore.screenLimitMin"
            :marks="{ 10: '10', 20: '20', 30: '30', 45: '45', 60: '60' }"
            :max="60"
            :min="10"
            :step="5"
          />
        </div>
        <p class="text-muted-foreground text-sm">
          {{ $t('parent.plan.screenAdvice') }}
        </p>
      </div>
    </Card>
  </div>
</template>
