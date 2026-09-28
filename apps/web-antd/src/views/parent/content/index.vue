<script lang="ts" setup>
import type { FieldDef, TileKey } from '#/data/modules';
import type { ContentItemBase } from '#/data/use-collection';

import { computed, ref } from 'vue';

import { Button, message, Popconfirm, Select, Table } from 'ant-design-vue';

import { libraryContentMeta } from '#/data/library-source';
import { hasContentFields, MODULES, TILE_KEYS } from '#/data/modules';
import { builtinOf, useCollection } from '#/data/use-content';
import { $t } from '#/locales';

import ContentFormModal from '../components/content-form-modal.vue';

/** 内容基座来自资料库表格还是内置题库（构建时确定，见 data/library-source.ts） */
const libraryMeta = libraryContentMeta;

const fetchedAtLabel = computed(() => {
  const raw = libraryMeta.fetchedAt;
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
});

/** 声明了 fields 的模块才在内容管理里出 Tab（英文乐园也算） */
const contentModules = TILE_KEYS.filter((key) =>
  hasContentFields(MODULES[key]),
);

/**
 * 默认选中第一个可编辑模块。
 * `MODULES.cards` 一定声明了 fields，兜底常量取不到的情况不会发生 ——
 * 写成 `find` + 兜底只是为了不用非空断言（oxlint 禁止 `!`）。
 */
const activeModule = ref<TileKey>(
  TILE_KEYS.find((key) => hasContentFields(MODULES[key])) ?? 'cards',
);

/** 当前 Tab 的内容是否由资料库表格提供（表格缺该模块时为 false，即用内置题库） */
const moduleFromLibrary = computed(
  () => libraryMeta.sourceOf[activeModule.value] === 'library',
);

/** 资料库表格的网页地址，方便家长直接去改内容 */
const tableUrl = computed(() =>
  libraryMeta.databaseId
    ? `https://www.workbuddy.cn/space/d/${libraryMeta.databaseId}`
    : '',
);

const activeFields = computed(() => MODULES[activeModule.value].fields ?? []);

/**
 * 当前模块是否有可筛选的 select 字段（看图识物的「分类」、中文乐园的「类型」）；
 * 有才显示筛选下拉。
 */
const filterField = computed(() =>
  activeFields.value.find(
    (field) =>
      field.type === 'select' &&
      (field.key === 'categoryId' || field.key === 'kind'),
  ),
);

/**
 * 传 getter 而非值：切 Tab 时模块会变，若在 setup 期解包，
 * 集合会永远绑定在第一个模块上（显示与写入都落在 cards）。
 */
const collection = useCollection<ContentItemBase>({
  defaults: () => builtinOf(activeModule.value),
  key: () => activeModule.value,
});

const formOpen = ref(false);
const editingId = ref<string>();
const filterCategory = ref<string>();

const list = computed(() =>
  filterCategory.value
    ? collection.items.value.filter(
        (item) =>
          (item as Record<string, any>)[filterField.value?.key ?? ''] ===
          filterCategory.value,
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

/** 按列 key 取回字段声明，bodyCell 才知道要不要把 select 的 value 翻成 label */
function fieldOf(key: string): FieldDef | undefined {
  return activeFields.value.find((field) => field.key === key);
}

/**
 * 单元格取值：select 字段要显示 label（否则表格里出现 pattern/sort 这类
 * 标识符），数组与多行文本统一成按行显示，避免「内置行逗号串、编辑后
 * 多行串」两种形态混在一起。
 */
function formatValue(field: FieldDef | undefined, record: Record<string, any>) {
  if (!field) return '';
  const raw = record[field.key];
  if (field.type === 'select') {
    return field.options?.().find((o) => o.value === raw)?.label ?? raw ?? '';
  }
  if (Array.isArray(raw)) return raw.join('\n');
  return raw ?? '';
}

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

    <!--
      内容来源说明：本页编辑的是「覆盖项」，真正的基座来自资料库表格或内置题库。
      不显式告知的话，家长会以为删掉一行就是彻底删掉了——实际只是加了一条覆盖。
    -->
    <div
      class="border-border bg-muted/40 text-muted-foreground mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs"
    >
      <span class="text-foreground font-medium">
        {{ $t('parent.content.sourceTitle') }}
      </span>
      <span>
        {{
          libraryMeta.active
            ? $t('parent.content.sourceLibrary', {
                count: libraryMeta.rowCount,
                time: fetchedAtLabel,
              })
            : $t('parent.content.sourceBuiltin')
        }}
      </span>
      <span>
        {{
          moduleFromLibrary
            ? $t('parent.content.sourceLibraryModule')
            : $t('parent.content.sourceBuiltinModule')
        }}
      </span>
      <span>{{ $t('parent.content.sourceTip') }}</span>
      <a
        v-if="tableUrl"
        class="text-primary hover:underline"
        :href="tableUrl"
        rel="noreferrer noopener"
        target="_blank"
      >
        {{ $t('parent.content.sourceTable') }} ↗
      </a>
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
          v-if="filterField"
          v-model:value="filterCategory"
          :placeholder="$t('parent.content.allCategories')"
          allow-clear
          class="w-48"
        >
          <Select.Option
            v-for="option in filterField.options?.() ?? []"
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
          <span class="whitespace-pre-line">
            {{ formatValue(filterField, record) }}
          </span>
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
        <template v-else>
          <span class="whitespace-pre-line">
            {{ formatValue(fieldOf(column.key as string), record) }}
          </span>
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
