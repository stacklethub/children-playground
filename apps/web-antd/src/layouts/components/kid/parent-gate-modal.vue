<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Input, message, Modal } from 'ant-design-vue';

import { $t } from '#/locales';
import { stopSpeak } from '#/utils/tts';

/** 家长中心入口（需成人验证，防止宝宝误入） */
const PARENT_HOME = '/parent/dashboard';

const open = defineModel<boolean>('open', { default: false });

const router = useRouter();
const answer = ref('');
const question = ref({ a: 0, b: 0 });

watch(open, (value) => {
  if (!value) return;
  stopSpeak();
  question.value = {
    a: 3 + Math.floor(Math.random() * 7),
    b: 4 + Math.floor(Math.random() * 6),
  };
  answer.value = '';
});

function confirm() {
  const { a, b } = question.value;
  if (Number(answer.value) === a * b) {
    open.value = false;
    router.push(PARENT_HOME);
  } else {
    message.error($t('kid.gate.wrong'));
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    :mask-closable="true"
    :title="$t('kid.gate.title')"
    @ok="confirm"
  >
    <div class="py-2 text-base">
      {{ $t('kid.gate.tip') }}
      <p class="my-3 text-2xl font-bold">
        {{ question.a }} × {{ question.b }} = ?
      </p>
      <Input
        v-model:value="answer"
        :placeholder="$t('kid.gate.placeholder')"
        type="number"
        @press-enter="confirm"
      />
    </div>
  </Modal>
</template>
