<script lang="ts" setup>
import type { ChildApi } from '#/api';

import { onMounted, ref } from 'vue';

import {
  Button,
  Card,
  message,
  Modal,
  Popconfirm,
  Spin,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';
import { useDeviceStore, useFamilyStore } from '#/store';

import ChildFormModal from '../components/child-form-modal.vue';

const familyStore = useFamilyStore();
const deviceStore = useDeviceStore();

const formOpen = ref(false);
const editing = ref<ChildApi.ChildProfile>();

onMounted(() => {
  void familyStore.fetchChildren();
});

function openAdd() {
  editing.value = undefined;
  formOpen.value = true;
}

function openEdit(child: ChildApi.ChildProfile) {
  editing.value = child;
  formOpen.value = true;
}

async function submit(draft: ChildApi.ChildDraft) {
  try {
    if (editing.value) {
      await familyStore.editChild(editing.value.id, draft);
      message.success($t('parent.common.saved'));
    } else {
      await familyStore.addChild(draft);
      message.success($t('parent.children.added'));
    }
  } catch {
    message.error($t('parent.common.syncFailed'));
  }
}

/**
 * 把某个孩子设为「这台设备的学习者」。
 * 这是唯一会改变宝宝端归属的操作（设备级），因此二次确认后再执行。
 */
function bindToDevice(child: ChildApi.ChildProfile) {
  Modal.confirm({
    cancelText: $t('parent.common.cancel'),
    content: $t('parent.children.bindConfirmContent', { name: child.name }),
    okText: $t('parent.children.bindConfirmOk'),
    title: $t('parent.children.bindConfirmTitle'),
    onOk: async () => {
      try {
        await deviceStore.bindChild(child);
        message.success(
          $t('parent.children.bindSuccess', { name: child.name }),
        );
      } catch {
        message.error($t('parent.common.syncFailed'));
      }
    },
  });
}

async function remove(child: ChildApi.ChildProfile) {
  try {
    await familyStore.removeChild(child.id);
    message.success($t('parent.children.deleted'));
  } catch {
    message.error($t('parent.common.syncFailed'));
  }
}
</script>

<template>
  <div class="p-5">
    <!-- 这台设备的学习者：与登录账号无关，只由家长显式绑定决定 -->
    <div
      class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
      :class="
        deviceStore.bound
          ? 'border-slate-200 bg-slate-50'
          : 'border-amber-300 bg-amber-50'
      "
    >
      <div class="flex items-center gap-3">
        <span class="text-3xl">{{
          deviceStore.boundChild?.avatar ?? '🧸'
        }}</span>
        <div>
          <div class="text-muted-foreground text-xs">
            {{ $t('parent.children.deviceLabel') }}
          </div>
          <div class="text-lg font-bold">
            {{
              deviceStore.boundChild?.name ?? $t('parent.children.deviceNone')
            }}
          </div>
        </div>
      </div>
      <p class="text-muted-foreground max-w-md text-xs">
        {{ $t('parent.children.deviceTip') }}
      </p>
    </div>

    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold">{{ $t('parent.children.title') }}</h2>
        <p class="text-muted-foreground text-sm">
          {{ $t('parent.children.tip') }}
        </p>
      </div>
      <Button type="primary" @click="openAdd">
        {{ $t('parent.children.add') }}
      </Button>
    </div>

    <Spin :spinning="familyStore.loading">
      <div
        v-if="familyStore.children.length === 0"
        class="text-muted-foreground py-16 text-center"
      >
        {{ $t('parent.children.empty') }}
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card v-for="child in familyStore.children" :key="child.id">
          <div class="flex items-start gap-4">
            <span class="text-5xl">{{ child.avatar }}</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-lg font-bold">{{ child.name }}</span>
                <Tag v-if="deviceStore.boundChildId === child.id" color="gold">
                  {{ $t('parent.children.deviceInUse') }}
                </Tag>
              </div>
              <p class="text-muted-foreground mt-1 text-sm">
                {{ $t('parent.children.birthday') }}:
                {{ child.birthday || '—' }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <Button
              :disabled="deviceStore.boundChildId === child.id"
              size="small"
              type="primary"
              ghost
              @click="bindToDevice(child)"
            >
              {{ $t('parent.children.bindToDevice') }}
            </Button>
            <Button size="small" @click="openEdit(child)">
              {{ $t('parent.common.edit') }}
            </Button>
            <Popconfirm
              :title="$t('parent.children.deleteConfirm')"
              @confirm="remove(child)"
            >
              <Button danger size="small">
                {{ $t('parent.common.delete') }}
              </Button>
            </Popconfirm>
          </div>
        </Card>
      </div>
    </Spin>

    <ChildFormModal v-model:open="formOpen" :child="editing" @submit="submit" />
  </div>
</template>
