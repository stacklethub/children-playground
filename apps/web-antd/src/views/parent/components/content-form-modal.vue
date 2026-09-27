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
import { pinyinOf } from '#/utils/pinyin';

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

const fields = computed<FieldDef[]>(
  () => MODULES[props.moduleKey].fields ?? [],
);

/** 用 Record 而非固定形状：字段随模块而变 */
const form = reactive<Record<string, any>>({});

function defaultValueOf(field: FieldDef) {
  if (field.type === 'number') return 0;
  if (field.type === 'select') return field.options?.()[0]?.value ?? '';
  return '';
}

/** 打开表单时会先把现有值灌进 form，那次赋值不该触发下面的自动派生 */
let hydrating = false;

watch(open, (value) => {
  if (!value) return;
  hydrating = true;
  for (const field of fields.value) {
    const raw = props.record?.[field.key] ?? defaultValueOf(field);
    // 诗句/选项在数据层是数组，直接绑给 textarea 会渲染成逗号串；
    // 家长一旦编辑就会把整串存回去，切句只认换行，诗会被压成一行。
    form[field.key] = Array.isArray(raw) ? raw.join('\n') : raw;
  }
  hydrating = false;
});

/**
 * 中文乐园「认汉字」条目：填了汉字就自动带出完整拼音（「苹果」→「píng guǒ」），
 * 省去家长自己查。学拼音条目要教的是声母/韵母字形（`b`、`ai`），cnchar
 * 判断不了该教哪个，不能自动转，只能由家长手填。
 * 同步 flush 是为了让上面的灌数据能挡住这次触发。
 */
watch(
  () => form.hanzi,
  (hanzi) => {
    if (hydrating || props.moduleKey !== 'pinyin' || !hanzi) return;
    if (form.kind !== 'hanzi') return;
    form.pinyin = pinyinOf(String(hanzi));
  },
  { flush: 'sync' },
);

/** 中文乐园里「认汉字」条目的拼音由汉字自动转出，表单里不暴露、避免手填冲突 */
const isPinyinAuto = computed(
  () => props.moduleKey === 'pinyin' && form.kind === 'hanzi',
);

/**
 * 切换条目类型时校正拼音：
 * 切到「认汉字」→ 若已填汉字则立刻带出完整拼音；
 * 切回「学拼音」→ 清空自动带出的整词拼音，让家长重填声母/韵母。
 */
watch(
  () => form.kind,
  (kind) => {
    if (hydrating || props.moduleKey !== 'pinyin') return;
    if (kind === 'hanzi') {
      if (form.hanzi) form.pinyin = pinyinOf(String(form.hanzi));
    } else {
      form.pinyin = '';
    }
  },
  { flush: 'sync' },
);

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

  // 只提交当前模块声明的字段：form 是长生命周期的 reactive，
  // 切过模块后会残留上一个模块的键与值，整体提交会写出混合条目。
  const draft = Object.fromEntries(
    fields.value.map((field) => [field.key, form[field.key]]),
  );

  // 认汉字条目的拼音完全由汉字派生：表单里没有拼音输入，这里兜底补上，
  // 保证 watch 未触发（如极端时序）时也能写出完整拼音。
  if (props.moduleKey === 'pinyin' && (draft.kind ?? 'pinyin') === 'hanzi') {
    draft.pinyin = pinyinOf(String(draft.hanzi ?? '').trim());
  }

  // 跨字段约束（如「正确答案必须属于选项」）由模块自己声明
  const error = MODULES[props.moduleKey].validate?.(draft);
  if (error) {
    message.warning($t(error.key, error.params ?? {}));
    return;
  }

  emit('submit', draft);
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
        <!-- 认汉字条目的拼音由汉字自动转出，表单里整项隐藏，不要求家长填 -->
        <template v-if="field.key === 'pinyin' && isPinyinAuto"></template>

        <Select
          v-else-if="field.type === 'select'"
          v-model:value="form[field.key]"
        >
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
