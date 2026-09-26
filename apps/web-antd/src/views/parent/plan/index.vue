<script lang="ts" setup>
import { computed, reactive } from 'vue';

import {
  Button,
  Card,
  InputNumber,
  message,
  Slider,
  Switch,
} from 'ant-design-vue';

import { $t } from '#/locales';
import {
  type LearnModule,
  MODULE_KEYS,
  MODULES,
  type ModuleSetting,
  useKidStore,
} from '#/store';

const kidStore = useKidStore();

const goals = reactive<Record<LearnModule, number>>(
  Object.fromEntries(
    MODULE_KEYS.map((key) => [key, kidStore.goalOf(key)]),
  ) as Record<LearnModule, number>,
);

/**
 * 声明了 range 的模块才有「开关 + 难度区间」。
 * 与内容管理共用同一套派生规则，同一模块可以两处都出现（如字母乐园）。
 */
const paramModules = computed(() =>
  MODULE_KEYS.flatMap((key) => {
    const def = MODULES[key];
    if (!def.range) return [];
    return [{ key, range: def.range }];
  }),
);

const settings = reactive<Record<string, { enabled: boolean; range: number }>>(
  Object.fromEntries(
    paramModules.value.map(({ key }) => [
      key,
      {
        enabled: kidStore.moduleEnabled(key),
        range: kidStore.moduleRange(key),
      },
    ]),
  ),
);

/**
 * 只落盘「与注册表默认值不同」的项。
 *
 * 若把整份表单写回，家长没动过的模块也会变成显式赋值，
 * `goalOf()` 与 `range.default` 的回落就永久失效了 ——
 * 以后调整注册表默认值，只对新设备生效。顺带获得
 * 「改回默认值即清除覆盖」的语义。
 */
function save() {
  kidStore.dailyGoals = Object.fromEntries(
    MODULE_KEYS.filter((key) => goals[key] !== MODULES[key].defaultGoal).map(
      (key) => [key, goals[key]],
    ),
  );

  // 在现有设置上合并，避免把本页不认识的模块设置整体覆盖掉
  const nextSettings = { ...kidStore.moduleSettings };
  for (const { key, range } of paramModules.value) {
    const current = settings[key];
    if (!current) continue;

    const patch: ModuleSetting = {};
    if (current.enabled === false) patch.enabled = false;
    if (current.range !== range.default) patch.range = current.range;

    if (Object.keys(patch).length === 0) {
      delete nextSettings[key];
    } else {
      nextSettings[key] = patch;
    }
  }
  kidStore.moduleSettings = nextSettings;

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
          v-for="{ key, range } in paramModules"
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
              :max="range.max"
              :min="range.min"
              class="flex-1"
            />
            <span class="w-24 text-right text-sm">
              {{
                $t('parent.plan.rangeHint', {
                  max: range.max,
                  min: range.min,
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
