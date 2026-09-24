<script lang="ts" setup>
import { computed, ref } from 'vue';

import {
  Button,
  Popconfirm,
  Select,
  Table,
  message,
} from 'ant-design-vue';

import { useContent, type CardDraft } from '#/data/use-content';
import { $t } from '#/locales';

import CardFormModal from '../components/card-form-modal.vue';

const { addCard, cards, categories, deleteCard, updateCard } = useContent();

const formOpen = ref(false);
const editingId = ref<string>();
const filterCategory = ref<string>();

const list = computed(() =>
  filterCategory.value
    ? cards.value.filter((c) => c.categoryId === filterCategory.value)
    : cards.value,
);

const editingCard = computed(() => {
  if (!editingId.value) return undefined;
  const card = cards.value.find((c) => c.id === editingId.value);
  return card ? { ...card } : undefined;
});

const columns = computed(() => [
  { dataIndex: 'emoji', key: 'emoji', title: $t('parent.content.emoji'), width: 80 },
  { dataIndex: 'name', key: 'name', title: $t('parent.content.name') },
  { dataIndex: 'pinyin', key: 'pinyin', title: $t('parent.content.pinyin') },
  { dataIndex: 'categoryId', key: 'categoryId', title: $t('parent.content.category') },
  { key: 'actions', title: $t('parent.content.actions'), width: 160 },
]);

const categoryName = (id: string) =>
  categories.value.find((c) => c.id === id)?.name ?? id;

function openAdd() {
  editingId.value = undefined;
  formOpen.value = true;
}

function openEdit(id: string) {
  editingId.value = id;
  formOpen.value = true;
}

function submit(draft: CardDraft) {
  if (editingId.value) {
    updateCard(editingId.value, draft);
    message.success($t('parent.content.saved'));
  } else {
    addCard(draft);
    message.success($t('parent.content.added'));
  }
}

function remove(id: string) {
  deleteCard(id);
  message.success($t('parent.content.deleted'));
}
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold">{{ $t('parent.content.title') }}</h2>
        <p class="text-muted-foreground text-sm">{{ $t('parent.content.tip') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Select
          v-model:value="filterCategory"
          :placeholder="$t('parent.content.allCategories')"
          allow-clear
          class="w-48"
        >
          <Select.Option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.emoji }} {{ category.name }}
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
          {{ categoryName(record.categoryId) }}
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

    <CardFormModal
      v-model:open="formOpen"
      :card="editingCard"
      :categories="categories"
      @submit="submit"
    />
  </div>
</template>
