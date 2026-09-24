<script lang="ts" setup>
import { reactive, watch } from 'vue';

import { Form, FormItem, Input, Modal, Select, message } from 'ant-design-vue';

import type { ChildApi } from '#/api';
import { $t } from '#/locales';

/** 新增/编辑孩子档案弹窗 */
const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{ child?: ChildApi.ChildProfile }>();

const emit = defineEmits<{
  submit: [draft: ChildApi.ChildDraft];
}>();

const AVATARS = ['🧒', '👦', '👧', '🧸', '🐣', '🦊', '🐼', '⭐'];

const form = reactive<ChildApi.ChildDraft>({
  avatar: AVATARS[0],
  birthday: '',
  name: '',
});

watch(open, (value) => {
  if (!value) return;
  Object.assign(form, {
    avatar: props.child?.avatar ?? AVATARS[0],
    birthday: props.child?.birthday ?? '',
    name: props.child?.name ?? '',
  });
});

function submit() {
  if (!form.name.trim()) {
    message.warning($t('parent.children.nameRequired'));
    return;
  }
  emit('submit', { ...form });
  open.value = false;
}
</script>

<template>
  <Modal
    v-model:open="open"
    :title="child ? $t('parent.children.edit') : $t('parent.children.add')"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem :label="$t('parent.children.name')" required>
        <Input
          v-model:value="form.name"
          :placeholder="$t('parent.children.namePlaceholder')"
        />
      </FormItem>
      <FormItem :label="$t('parent.children.avatar')">
        <Select v-model:value="form.avatar">
          <Select.Option v-for="avatar in AVATARS" :key="avatar" :value="avatar">
            {{ avatar }}
          </Select.Option>
        </Select>
      </FormItem>
      <FormItem :label="$t('parent.children.birthday')">
        <Input v-model:value="form.birthday" type="date" />
      </FormItem>
    </Form>
  </Modal>
</template>
