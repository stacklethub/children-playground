<script lang="ts" setup>
import type { CardDraft, KidCategory } from '#/data/use-content';

import { reactive, watch } from 'vue';

import { Form, FormItem, Input, message, Modal, Select } from 'ant-design-vue';

import { $t } from '#/locales';

const props = defineProps<{
  categories: KidCategory[];
  card?: CardDraft & { id: string };
}>();

const emit = defineEmits<{ submit: [draft: CardDraft] }>();

/** 新增/编辑「看图识物」卡片 */
const open = defineModel<boolean>('open', { default: false });

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
        <Input
          v-model:value="form.name"
          :placeholder="$t('parent.content.namePlaceholder')"
        />
      </FormItem>
      <FormItem :label="$t('parent.content.pinyin')">
        <Input
          v-model:value="form.pinyin"
          :placeholder="$t('parent.content.pinyinPlaceholder')"
        />
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
          :placeholder="$t('parent.content.factPlaceholder')"
          :rows="2"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
