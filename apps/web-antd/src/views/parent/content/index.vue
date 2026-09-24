<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import {
  Button,
  Form,
  FormItem,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  message,
} from 'ant-design-vue';

import { useContent, type CardDraft } from '#/data/use-content';

const { cards, categories, addCard, updateCard, deleteCard } = useContent();

const showForm = ref(false);
const editingId = ref<string>();
const filterCategory = ref<string>();

const form = reactive<CardDraft>({
  categoryId: 'animals',
  emoji: '🙂',
  fact: '',
  name: '',
  pinyin: '',
});

const list = computed(() =>
  filterCategory.value
    ? cards.value.filter((c) => c.categoryId === filterCategory.value)
    : cards.value,
);

const categoryName = (id: string) =>
  categories.value.find((c) => c.id === id)?.name ?? id;

function openAdd() {
  editingId.value = undefined;
  Object.assign(form, {
    categoryId: 'animals',
    emoji: '🙂',
    fact: '',
    name: '',
    pinyin: '',
  });
  showForm.value = true;
}

function openEdit(id: string) {
  const card = cards.value.find((c) => c.id === id);
  if (!card) return;
  editingId.value = id;
  Object.assign(form, {
    categoryId: card.categoryId,
    emoji: card.emoji,
    fact: card.fact ?? '',
    name: card.name,
    pinyin: card.pinyin,
  });
  showForm.value = true;
}

function save() {
  if (!form.name.trim()) {
    message.warning('请填写名称');
    return;
  }
  if (editingId.value) {
    updateCard(editingId.value, { ...form });
    message.success('已保存');
  } else {
    addCard({ ...form });
    message.success('已添加');
  }
  showForm.value = false;
}

const columns = [
  { dataIndex: 'emoji', key: 'emoji', title: '图标', width: 80 },
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'pinyin', key: 'pinyin', title: '拼音' },
  { dataIndex: 'categoryId', key: 'categoryId', title: '分类' },
  { key: 'actions', title: '操作', width: 160 },
];
</script>

<template>
  <div class="p-5">
    <div class="mb-4 flex items-center justify-between gap-4">
      <Select
        v-model:value="filterCategory"
        allow-clear
        class="w-48"
        placeholder="全部分类"
      >
        <Select.Option
          v-for="c in categories"
          :key="c.id"
          :value="c.id"
        >
          {{ c.emoji }} {{ c.name }}
        </Select.Option>
      </Select>
      <Button type="primary" @click="openAdd">新增卡片</Button>
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
            编辑
          </Button>
          <Popconfirm
            title="确定删除这张卡片吗？"
            @confirm="deleteCard(record.id); message.success('已删除')"
          >
            <Button danger size="small" type="link">删除</Button>
          </Popconfirm>
        </template>
      </template>
    </Table>

    <Modal
      v-model:open="showForm"
      :title="editingId ? '编辑卡片' : '新增卡片'"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="名称" required>
          <Input v-model:value="form.name" placeholder="如：大象" />
        </FormItem>
        <FormItem label="拼音">
          <Input v-model:value="form.pinyin" placeholder="如：dà xiàng" />
        </FormItem>
        <FormItem label="图标（emoji）">
          <Input v-model:value="form.emoji" placeholder="如：🐘" />
        </FormItem>
        <FormItem label="分类">
          <Select v-model:value="form.categoryId">
            <Select.Option
              v-for="c in categories"
              :key="c.id"
              :value="c.id"
            >
              {{ c.emoji }} {{ c.name }}
            </Select.Option>
          </Select>
        </FormItem>
        <FormItem label="小知识（朗读时念给孩子听）">
          <Input.TextArea
            v-model:value="form.fact"
            :rows="2"
            placeholder="如：大象的鼻子长长的，会喷水哦"
          />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>
