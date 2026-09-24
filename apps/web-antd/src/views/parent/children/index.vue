<script lang="ts" setup>
import type { ChildApi } from '#/api';

import { onMounted, ref } from 'vue';

import { Button, Card, message, Popconfirm, Spin, Tag } from 'ant-design-vue';

import { $t } from '#/locales';
import { useFamilyStore, useKidStore } from '#/store';

import ChildFormModal from '../components/child-form-modal.vue';

const familyStore = useFamilyStore();
const kidStore = useKidStore();

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

async function setCurrent(child: ChildApi.ChildProfile) {
  await familyStore.setCurrentChild(child.id);
  message.success($t('parent.children.switchSuccess'));
}

async function remove(child: ChildApi.ChildProfile) {
  try {
    await familyStore.removeChild(child.id);
    // 同步清理该孩子的本机记录
    kidStore.clearRecords(child.id);
    message.success($t('parent.children.deleted'));
  } catch {
    message.error($t('parent.common.syncFailed'));
  }
}
</script>

<template>
  <div class="p-5">
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
                <Tag
                  v-if="familyStore.currentChildId === child.id"
                  color="gold"
                >
                  {{ $t('parent.children.current') }}
                </Tag>
              </div>
              <p class="text-muted-foreground mt-1 text-sm">
                {{ $t('parent.children.birthday') }}:
                {{ child.birthday || '—' }}
              </p>
              <p class="text-muted-foreground text-sm">
                {{ $t('parent.dashboard.statStars') }}:
                {{ kidStore.starsOf(child.id) }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <Button
              :disabled="familyStore.currentChildId === child.id"
              size="small"
              type="primary"
              ghost
              @click="setCurrent(child)"
            >
              {{ $t('parent.children.setCurrent') }}
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
