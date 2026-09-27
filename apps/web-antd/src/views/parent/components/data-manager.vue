<script lang="ts" setup>
import { Button, Card, message, Upload } from 'ant-design-vue';

import { $t } from '#/locales';

import { useDataManager } from '../hooks/use-data-manager';

const {
  bindFile,
  bound,
  exportJson,
  importJson,
  saveAsBound,
  syncToBound,
  unbindFile,
} = useDataManager();

function handleImport(file: File) {
  void importJson(file)
    .then(() => message.success($t('parent.data.importDone')))
    .catch(() => message.error($t('parent.data.importFailed')));
  return false;
}

async function handleBind() {
  try {
    await bindFile();
    message.success($t('parent.data.bindDone'));
  } catch {
    message.error($t('parent.data.bindFailed'));
  }
}

async function handleSaveAs() {
  try {
    await saveAsBound();
    message.success($t('parent.data.bindDone'));
  } catch {
    message.error($t('parent.data.bindFailed'));
  }
}

async function handleSync() {
  try {
    await syncToBound();
    message.success($t('parent.data.syncDone'));
  } catch {
    message.error($t('parent.data.syncFailed'));
  }
}

async function handleUnbind() {
  await unbindFile();
  message.success($t('parent.data.unbindDone'));
}
</script>

<template>
  <Card :title="$t('parent.data.title')">
    <div class="flex flex-col gap-4">
      <p class="text-muted-foreground text-sm">{{ $t('parent.data.tip') }}</p>

      <div class="flex flex-wrap gap-3">
        <Button @click="exportJson">{{ $t('parent.data.export') }}</Button>
        <Upload
          :before-upload="handleImport"
          :show-upload-list="false"
          accept=".json"
        >
          <Button>{{ $t('parent.data.import') }}</Button>
        </Upload>
      </div>

      <div class="border-t pt-4">
        <p class="text-muted-foreground mb-2 text-sm">
          {{ $t('parent.data.bindTip') }}
        </p>
        <div class="flex flex-wrap gap-3">
          <Button v-if="!bound" @click="handleBind">
            {{ $t('parent.data.bind') }}
          </Button>
          <template v-else>
            <Button @click="handleSaveAs">
              {{ $t('parent.data.saveAs') }}
            </Button>
            <Button @click="handleSync">{{ $t('parent.data.sync') }}</Button>
            <Button danger @click="handleUnbind">
              {{ $t('parent.data.unbind') }}
            </Button>
          </template>
        </div>
      </div>
    </div>
  </Card>
</template>
