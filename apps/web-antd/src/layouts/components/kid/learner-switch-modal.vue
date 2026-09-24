<script lang="ts" setup>
import { Button, message, Modal } from 'ant-design-vue';

import { $t } from '#/locales';
import { useDeviceStore } from '#/store';

/**
 * 家长操作面板（宝宝端，需先通过成人验证）。
 *
 * 「这台设备的学习者」是设备级设置，与家长登录态无关，
 * 因此这里允许家长不登录账号就切换/解除，避免登录一次就顺手改掉设备归属。
 */
const emit = defineEmits<{ enterParent: [] }>();
const open = defineModel<boolean>('open', { default: false });

const deviceStore = useDeviceStore();

function choose(childId: string) {
  if (childId === deviceStore.boundChildId) {
    open.value = false;
    return;
  }
  if (deviceStore.switchChild(childId)) {
    open.value = false;
    message.success($t('kid.switch.switched'));
  } else {
    message.error($t('kid.switch.failed'));
  }
}

function confirmUnbind() {
  Modal.confirm({
    cancelText: $t('kid.switch.unbindCancel'),
    content: $t('kid.switch.unbindTip'),
    okText: $t('kid.switch.unbindOk'),
    title: $t('kid.switch.unbindConfirm'),
    onOk: () => {
      deviceStore.unbindCurrent();
      open.value = false;
      message.success($t('kid.switch.unbound'));
    },
  });
}
</script>

<template>
  <Modal v-model:open="open" :footer="null" :title="$t('kid.switch.title')">
    <p class="text-muted-foreground mb-4 text-sm">
      {{ $t('kid.switch.tip') }}
    </p>

    <div class="flex flex-col gap-3">
      <button
        v-for="child in deviceStore.knownChildren"
        :key="child.id"
        class="flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition"
        :class="
          child.id === deviceStore.boundChildId
            ? 'border-amber-400 bg-amber-50'
            : 'border-slate-200 hover:border-slate-300'
        "
        @click="choose(child.id)"
      >
        <span class="text-3xl">{{ child.avatar }}</span>
        <span class="flex-1 text-lg font-bold">{{ child.name }}</span>
        <span
          v-if="child.id === deviceStore.boundChildId"
          class="text-sm font-bold text-amber-500"
        >
          ✓ {{ $t('kid.switch.current') }}
        </span>
      </button>
    </div>

    <div class="mt-5 flex items-center justify-between gap-3">
      <Button danger type="text" @click="confirmUnbind">
        {{ $t('kid.switch.unbind') }}
      </Button>
      <Button type="primary" @click="emit('enterParent')">
        {{ $t('kid.switch.toParent') }}
      </Button>
    </div>
  </Modal>
</template>
