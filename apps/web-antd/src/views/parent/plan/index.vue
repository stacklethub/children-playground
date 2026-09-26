<script lang="ts" setup>
import { reactive } from 'vue';

import {
  Button,
  Card,
  InputNumber,
  message,
  Slider,
  Switch,
} from 'ant-design-vue';

import { $t } from '#/locales';
import { type LearnModule, MODULE_KEYS, MODULES, useKidStore } from '#/store';

const kidStore = useKidStore();

const goals = reactive<Record<LearnModule, number>>(
  Object.fromEntries(
    MODULE_KEYS.map((key) => [key, kidStore.goalOf(key)]),
  ) as Record<LearnModule, number>,
);

/** 参数型模块设置（开关 + 难度区间） */
const paramModules = MODULE_KEYS.filter((key) => MODULES[key].kind === 'param');

const settings = reactive<Record<string, { enabled: boolean; range: number }>>(
  Object.fromEntries(
    paramModules.map((key) => [
      key,
      {
        enabled: kidStore.moduleEnabled(key),
        range: kidStore.moduleRange(key),
      },
    ]),
  ),
);

function save() {
  kidStore.dailyGoals = { ...goals };
  kidStore.moduleSettings = Object.fromEntries(
    paramModules.map((key) => [
      key,
      { enabled: settings[key]!.enabled, range: settings[key]!.range },
    ]),
  );
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
            {{ MODULES[module].emoji }} {{ $t(`kid.modules.${module}`) }} （{{
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

    <Card :title="$t('parent.plan.moduleTitle')">
      <div class="flex flex-col gap-5">
        <p class="text-muted-foreground text-sm">
          {{ $t('parent.plan.moduleTip') }}
        </p>
        <div
          v-for="key in paramModules"
          :key="key"
          class="flex flex-col gap-3 rounded-lg border border-solid p-4"
        >
          <div class="flex items-center justify-between">
            <span class="text-base">
              {{ MODULES[key].emoji }} {{ $t(`kid.modules.${key}`) }}
            </span>
            <Switch v-model:checked="settings[key]!.enabled" />
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm">{{ $t('parent.plan.rangeLabel') }}</span>
            <Slider
              v-model:value="settings[key]!.range"
              :disabled="!settings[key]!.enabled"
              :max="MODULES[key].range!.max"
              :min="MODULES[key].range!.min"
              class="flex-1"
            />
            <span class="w-16 text-right text-sm">
              {{
                $t('parent.plan.rangeHint', {
                  max: MODULES[key].range!.max,
                  min: MODULES[key].range!.min,
                  value: settings[key]!.range,
                })
              }}
            </span>
          </div>
        </div>
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
