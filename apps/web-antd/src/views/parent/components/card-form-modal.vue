<script lang="ts" setup>
import { reactive, watch } from 'vue';

import {
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  message,
} from 'ant-design-vue';

import type { CardDraft, KidCategory } from '#/data/use-content';
import { $t } from '#/locales';

/** 新增/编辑「看图识物」卡片 */
const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  categories: KidCategory[];
  card?: CardDraft & { id: string };
}>();

const emit = defineEmits<{ submit: [draft: CardDraft] }>();

const form = reactive<CardDraft>({
  categoryId: 'animals',
  emoji: '🙂',
  fact: '',
  name: '',
  pinyin: '',
});

watch(open, (value) => {
  if (!value) return;
  Object.assign(form, {
    categoryId: props.card?.categoryId ?? props.categories[0]?.id ?? 'animals',
    emoji: props.card?.emoji ?? '🙂',
    fact: props.card?.fact ?? '',
    name: props.card?.name ?? '',
    pinyin: props.card?.pinyin ?? '',
  });
});

function submit() {
  if (!form.name.trim()) {
    message.warning($t('parent.content.nameRequired'));
    return;
  }
  emit('submit', { ...form });
  open.value = false;
}
</script>

<template>
  <Modal
    v-model:open="open"
    :title="card ? $t('parent.content.edit') : $t('parent.content.add')"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem :label="$t('parent.content.name')" required>
        <Input v-model:value="form.name" placeholder="大象" />
      </FormItem>
      <FormItem :label="$t('parent.content.pinyin')">
        <Input v-model:value="form.pinyin" placeholder="dà xiàng" />
      </FormItem>
      <FormItem :label="$t('parent.content.emoji')">
        <Input v-model:value="form.emoji" placeholder="🐘" />
      </FormItem>
      <FormItem :label="$t('parent.content.category')">
        <Select v-model:value="form.categoryId">
          <Select.Option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.emoji }} {{ category.name }}
          </Select.Option>
        </Select>
      </FormItem>
      <FormItem :label="$t('parent.content.fact')">
        <Input.TextArea
          v-model:value="form.fact"
          :rows="2"
          placeholder="大象的鼻子长长的，会喷水哦"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
