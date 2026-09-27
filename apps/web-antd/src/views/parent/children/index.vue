<script lang="ts" setup>
import type { ChildApi } from '#/api';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

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
import { resolveEnterKidAction } from '../hooks/enter-kid';

const familyStore = useFamilyStore();
const deviceStore = useDeviceStore();
const router = useRouter();

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

/** 跳到宝宝端学习岛首页（唯一的目的地） */
function goKidHome() {
  void router.push({ name: 'KidHome' });
}

/**
 * 快速进入宝宝端：把孩子设为「这台设备的学习者」，然后直接跳到学习岛。
 *
 * 它和 `bindToDevice` 的区别是**会跳走**，副作用边界见 `enter-kid.ts`：
 * 已经是当前学习者时是纯导航（点多少次都不改变任何状态）；设备还没绑过孩子时
 * 直接绑定进入；当前学习者是**别的孩子**时先二次确认再切（守住「设备学习者
 * 只能由家长显式变更」这条约定）。
 */
async function enterKid(child: ChildApi.ChildProfile) {
  const action = resolveEnterKidAction(deviceStore.boundChildId, child.id);

  if (action === 'navigate') {
    goKidHome();
    return;
  }

  if (action === 'bind') {
    await deviceStore.bindChild(child);
    goKidHome();
    return;
  }

  Modal.confirm({
    cancelText: $t('parent.common.cancel'),
    content: $t('parent.children.switchConfirmContent', {
      current: deviceStore.boundChild?.name ?? '',
      name: child.name,
    }),
    okText: $t('parent.children.switchConfirmOk'),
    title: $t('parent.children.switchConfirmTitle'),
    onOk: async () => {
      await deviceStore.bindChild(child);
      goKidHome();
    },
  });
}

async function remove(child: ChildApi.ChildProfile) {
  try {
    // oxlint-disable-next-line unicorn/prefer-dom-node-remove -- family store 的业务方法，非 DOM API
    await familyStore.removeChild(child.id);
    message.success($t('parent.children.deleted'));
  } catch {
    message.error($t('parent.common.syncFailed'));
  }
}
</script>

<template>
  <div class="p-5">
    <!--
      这台设备的学习者：与登录账号无关，只由家长显式绑定决定。

      配色必须走主题令牌（`border-border` / `bg-muted` / `border-warning` 等），
      不能用 Tailwind 的字面色阶（原来的 `bg-slate-50` / `bg-amber-50`）：这里的
      文字用的是 `text-muted-foreground`，暗色主题下它是浅灰，压在写死的近白底色
      上会直接看不清 —— 字面色阶不随框架主题切换，令牌才随。
    -->
    <div
      class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
      :class="
        deviceStore.bound
          ? 'border-border bg-muted'
          : 'border-warning/60 bg-warning/10'
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
            <Button size="small" type="primary" @click="enterKid(child)">
              {{ $t('parent.children.enterKid') }}
            </Button>
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
