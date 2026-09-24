<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Button, Card, message, Popconfirm, Switch } from 'ant-design-vue';

import { $t } from '#/locales';
import { useDeviceStore, useFamilyStore, useKidStore } from '#/store';
import { isTtsEnabled, setTtsEnabled } from '#/utils/tts';

import KidSelector from '../components/kid-selector.vue';

const familyStore = useFamilyStore();
const deviceStore = useDeviceStore();
const kidStore = useKidStore();

const ttsEnabled = ref(isTtsEnabled());
/** 本机数据统计/清理范围（'' = 全部孩子） */
const scopeChildId = ref('');

const localRecords = computed(() =>
  scopeChildId.value
    ? kidStore.recordsOf(scopeChildId.value)
    : kidStore.records,
);
const localStats = computed(() => ({
  records: localRecords.value.length,
  stars: localRecords.value.reduce((sum, r) => sum + (r.stars ?? 0), 0),
}));
const scopeName = computed(
  () =>
    familyStore.findChild(scopeChildId.value)?.name ??
    $t('parent.settings.scopeAll'),
);

function onTtsChange(checked: boolean | number | string) {
  setTtsEnabled(Boolean(checked));
  message.success(
    checked ? $t('parent.settings.ttsOn') : $t('parent.settings.ttsOff'),
  );
}

function resetLocal() {
  kidStore.clearRecords(scopeChildId.value || undefined);
  message.success($t('parent.settings.resetDone'));
}

onMounted(() => {
  void familyStore.fetchChildren();
});
</script>

<template>
  <div class="grid gap-5 p-5 lg:grid-cols-2">
    <Card :title="$t('parent.settings.childTitle')">
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <span class="text-base">{{
            $t('parent.settings.deviceLearner')
          }}</span>
          <span class="font-bold">
            {{
              deviceStore.boundChild
                ? `${deviceStore.boundChild.avatar} ${deviceStore.boundChild.name}`
                : $t('parent.children.deviceNone')
            }}
          </span>
        </div>
        <p class="text-muted-foreground text-xs">
          {{ $t('parent.settings.deviceLearnerTip') }}
        </p>
        <div class="flex items-center justify-between">
          <span class="text-base">{{ $t('parent.settings.tts') }}</span>
          <Switch
            v-model:checked="ttsEnabled"
            :checked-children="$t('parent.settings.on')"
            :un-checked-children="$t('parent.settings.off')"
            @change="onTtsChange"
          />
        </div>
      </div>
    </Card>

    <Card :title="$t('parent.settings.dataTitle')">
      <div class="flex flex-col gap-4">
        <p class="text-muted-foreground text-sm">
          {{ $t('parent.settings.dataTip') }}
        </p>
        <KidSelector v-model:child-id="scopeChildId" />
        <div class="text-muted-foreground text-sm">
          {{
            $t('parent.settings.dataStat', {
              records: localStats.records,
              stars: localStats.stars,
            })
          }}
        </div>
        <Popconfirm
          :title="$t('parent.settings.resetConfirmScope', { scope: scopeName })"
          @confirm="resetLocal"
        >
          <Button danger>{{ $t('parent.settings.reset') }}</Button>
        </Popconfirm>
      </div>
    </Card>
  </div>
</template>
