<script lang="ts" setup>
import type { FieldDef, TileKey } from '#/data/modules';

import { computed, reactive, watch } from 'vue';

import {
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
} from 'ant-design-vue';

import { MODULES } from '#/data/modules';
import { $t } from '#/locales';

/**
 * 字段驱动的家长端内容表单：
 * 字段与校验规则来自模块注册表的 fields 声明，一套代码覆盖所有内容型模块。
 */
const props = defineProps<{
  moduleKey: TileKey;
  /** 编辑时的现有值；新增时为 undefined */
  record?: Record<string, any>;
}>();

const emit = defineEmits<{ submit: [draft: Record<string, any>] }>();

const open = defineModel<boolean>('open', { default: false });

const fields = computed<FieldDef[]>(() => MODULES[props.moduleKey].fields ?? []);

/** 用 Record 而非固定形状：字段随模块而变 */
const form = reactive<Record<string, any>>({});

function defaultValueOf(field: FieldDef) {
  if (field.type === 'number') return 0;
  if (field.type === 'select') return field.options?.()[0]?.value ?? '';
  return '';
}

watch(open, (value) => {
  if (!value) return;
  for (const field of fields.value) {
    form[field.key] = props.record?.[field.key] ?? defaultValueOf(field);
  }
});

function isEmpty(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  return !String(value ?? '').trim();
}

function submit() {
  for (const field of fields.value) {
    if (!field.required) continue;
    if (isEmpty(form[field.key])) {
      message.warning(
        $t('parent.content.required', {
          field: $t(`parent.content.${field.labelKey}`),
        }),
      );
      return;
    }
  }
  emit('submit', { ...form });
  open.value = false;
}
</script>

<template>
  <Modal
    v-model:open="open"
    :title="record ? $t('parent.common.edit') : $t('parent.common.add')"
    @ok="submit"
  >
    <Form layout="vertical">
      <FormItem
        v-for="field in fields"
        :key="field.key"
        :label="$t(`parent.content.${field.labelKey}`)"
        :required="field.required"
      >
        <Select v-if="field.type === 'select'" v-model:value="form[field.key]">
          <Select.Option
            v-for="option in field.options?.() ?? []"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </Select.Option>
        </Select>

        <InputNumber
          v-else-if="field.type === 'number'"
          v-model:value="form[field.key]"
          class="w-full"
        />

        <Input.TextArea
          v-else-if="field.type === 'textarea'"
          v-model:value="form[field.key]"
          :maxlength="field.maxLength"
          :rows="2"
        />

        <Input
          v-else
          v-model:value="form[field.key]"
          :maxlength="field.maxLength"
          :placeholder="field.type === 'emoji' ? '🐘' : ''"
        />
      </FormItem>
    </Form>
  </Modal>
</template>
