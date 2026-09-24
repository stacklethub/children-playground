<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Button, Card, Popconfirm, Switch, message } from 'ant-design-vue';

import { $t } from '#/locales';
import { useFamilyStore, useKidStore } from '#/store';
import { isTtsEnabled, setTtsEnabled } from '#/utils/tts';

const familyStore = useFamilyStore();
const kidStore = useKidStore();

const ttsEnabled = ref(isTtsEnabled());

const currentChildName = computed(
  () => familyStore.currentChild?.name ?? $t('parent.common.noChild'),
);
const localStats = computed(() => ({
  records: kidStore.recordsOf(familyStore.currentChildId).length,
  stars: kidStore.starsOf(familyStore.currentChildId),
}));

function onTtsChange(checked: boolean | number | string) {
  setTtsEnabled(Boolean(checked));
  message.success(
    checked ? $t('parent.settings.ttsOn') : $t('parent.settings.ttsOff'),
  );
}

function resetLocal() {
  kidStore.clearRecords(familyStore.currentChildId);
  message.success($t('parent.settings.resetDone'));
}
</script>

<template>
  <div class="grid gap-5 p-5 lg:grid-cols-2">
    <Card :title="$t('parent.settings.childTitle')">
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <span class="text-base">{{ $t('parent.settings.childName') }}</span>
          <span class="font-bold">🧒 {{ currentChildName }}</span>
        </div>
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
        <div class="text-muted-foreground text-sm">
          {{
            $t('parent.settings.dataStat', {
              records: localStats.records,
              stars: localStats.stars,
            })
          }}
        </div>
        <Popconfirm
          :title="$t('parent.settings.resetConfirm')"
          @confirm="resetLocal"
        >
          <Button danger>{{ $t('parent.settings.reset') }}</Button>
        </Popconfirm>
      </div>
    </Card>
  </div>
</template>
