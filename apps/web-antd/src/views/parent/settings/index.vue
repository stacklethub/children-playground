<script setup lang="ts">
import { ref } from 'vue';

import { Button, Card, Input, Popconfirm, Switch, message } from 'ant-design-vue';

import { useKidStore } from '#/store';
import { isTtsEnabled, setTtsEnabled } from '#/utils/tts';

const kidStore = useKidStore();
const ttsEnabled = ref(isTtsEnabled());

function onNameChange() {
  message.success('昵称已保存');
}

function onTtsChange(checked: boolean | number | string) {
  setTtsEnabled(Boolean(checked));
  message.success(checked ? '语音引导已开启' : '语音引导已关闭');
}

function resetAll() {
  kidStore.$reset();
  message.success('已重置全部学习数据');
}
</script>

<template>
  <div class="grid gap-5 p-5 lg:grid-cols-2">
    <Card title="孩子信息">
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <span class="text-base">孩子昵称</span>
          <Input
            v-model:value="kidStore.childName"
            class="w-48"
            placeholder="宝宝"
            @change="onNameChange"
          />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-base">语音引导（TTS）</span>
          <Switch
            v-model:checked="ttsEnabled"
            checked-children="开"
            un-checked-children="关"
            @change="onTtsChange"
          />
        </div>
      </div>
    </Card>

    <Card title="数据管理">
      <div class="flex flex-col gap-4">
        <p class="text-muted-foreground text-sm">
          学习记录、星星与徽章保存在本机浏览器中。重置后将清空全部数据，且无法恢复。
        </p>
        <div class="text-muted-foreground text-sm">
          当前数据：{{ kidStore.records.length }} 条学习记录 ·
          {{ kidStore.stars }} 颗星星
        </div>
        <Popconfirm
          title="确定重置全部学习数据吗？此操作无法恢复！"
          @confirm="resetAll"
        >
          <Button danger>重置全部数据</Button>
        </Popconfirm>
      </div>
    </Card>
  </div>
</template>
