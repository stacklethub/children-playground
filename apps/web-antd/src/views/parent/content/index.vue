<script lang="ts" setup>
import type { TileKey } from '#/data/modules';
import type { ContentItemBase } from '#/data/use-collection';

import { computed, ref } from 'vue';

import { Button, message, Popconfirm, Select, Table } from 'ant-design-vue';

import { MODULES, TILE_KEYS } from '#/data/modules';
import { builtinOf, useCollection } from '#/data/use-content';
import { $t } from '#/locales';

import ContentFormModal from '../components/content-form-modal.vue';

/** 只把内容型模块做成 Tab */
const contentModules = TILE_KEYS.filter((key) => MODULES[key].kind === 'content');

const activeModule = ref<TileKey>(contentModules[0]!);

const activeFields = computed(() => MODULES[activeModule.value].fields ?? []);

/** 当前模块是否有「分类」字段；有才显示分类筛选（沿用改造前的筛选能力） */
const categoryField = computed(() =>
  activeFields.value.find((field) => field.key === 'categoryId'),
);

const collection = useCollection<ContentItemBase>({
  defaults: builtinOf(activeModule.value),
  key: activeModule.value,
});

const formOpen = ref(false);
const editingId = ref<string>();
const filterCategory = ref<string>();

const list = computed(() =>
  filterCategory.value
    ? collection.items.value.filter(
        (item) => (item as Record<string, any>).categoryId === filterCategory.value,
      )
    : collection.items.value,
);

const editingRecord = computed(() => {
  if (!editingId.value) return undefined;
  return collection.items.value.find((item) => item.id === editingId.value);
});

const columns = computed(() => [
  ...activeFields.value.map((field) => ({
    dataIndex: field.key,
    key: field.key,
    title: $t(`parent.content.${field.labelKey}`),
    width: field.type === 'emoji' ? 80 : undefined,
  })),
  { key: 'actions', title: $t('parent.content.actions'), width: 160 },
]);

function switchModule(key: TileKey) {
  activeModule.value = key;
  editingId.value = undefined;
  filterCategory.value = undefined;
  formOpen.value = false;
}

function openAdd() {
  editingId.value = undefined;
  formOpen.value = true;
}

function openEdit(id: string) {
  editingId.value = id;
  formOpen.value = true;
}

function submit(draft: Record<string, any>) {
  if (editingId.value) {
    collection.update(editingId.value, draft);
    message.success($t('parent.content.saved'));
  } else {
    collection.add(draft);
    message.success($t('parent.content.added'));
  }
}

function remove(id: string) {
  collection.remove(id);
  message.success($t('parent.content.deleted'));
}
</script>

<template>
  <div class="p-5">
    <div class="mb-4">
      <h2 class="text-lg font-bold">{{ $t('parent.content.title') }}</h2>
      <p class="text-muted-foreground text-sm">
        {{ $t('parent.content.tip') }}
      </p>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div
        class="flex flex-wrap gap-2"
        role="tablist"
        :aria-label="$t('parent.content.modules')"
      >
        <Button
          v-for="key in contentModules"
          :key="key"
          :aria-selected="key === activeModule"
          :type="key === activeModule ? 'primary' : 'default'"
          role="tab"
          @click="switchModule(key)"
        >
          {{ MODULES[key].emoji }} {{ $t(`kid.modules.${key}`) }}
        </Button>
      </div>
      <div class="flex items-center gap-3">
        <Select
          v-if="categoryField"
          v-model:value="filterCategory"
          :placeholder="$t('parent.content.allCategories')"
          allow-clear
          class="w-48"
        >
          <Select.Option
            v-for="option in categoryField.options?.() ?? []"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </Select.Option>
        </Select>
        <Button type="primary" @click="openAdd">
          {{ $t('parent.content.add') }}
        </Button>
      </div>
    </div>

    <Table
      :columns="columns"
      :data-source="list"
      :pagination="{ pageSize: 10 }"
      row-key="id"
      size="middle"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'emoji'">
          <span class="text-2xl">{{ record.emoji }}</span>
        </template>
        <template v-else-if="column.key === 'categoryId'">
          {{
            categoryField?.options?.().find((o) => o.value === record.categoryId)
              ?.label ?? record.categoryId
          }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <Button size="small" type="link" @click="openEdit(record.id)">
            {{ $t('parent.common.edit') }}
          </Button>
          <Popconfirm
            :title="$t('parent.content.deleteConfirm')"
            @confirm="remove(record.id)"
          >
            <Button danger size="small" type="link">
              {{ $t('parent.common.delete') }}
            </Button>
          </Popconfirm>
        </template>
      </template>
    </Table>

    <ContentFormModal
      v-model:open="formOpen"
      :module-key="activeModule"
      :record="editingRecord"
      @submit="submit"
    />
  </div>
</template>
