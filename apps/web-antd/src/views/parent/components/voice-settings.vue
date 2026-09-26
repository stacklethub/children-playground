<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { Card, message, Select, Slider, Switch } from 'ant-design-vue';

import { $t } from '#/locales';
import { hasVoiceFor, setTtsEnabled } from '#/utils/tts';
import {
  type AzureVoice,
  fetchAzureVoices,
  isAzureConfigured,
} from '#/utils/tts-azure';
import {
  getTtsSettings,
  saveTtsSettings,
  type TtsLang,
  type TtsSource,
} from '#/utils/tts-settings';

/**
 * 家长端「语音朗读」设置：语音源、中英文音色、语速、音调。
 *
 * 音色分两条通道存（见 TtsVoices 的说明）：Azure 用音色 id，系统语音用
 * SpeechSynthesisVoice.name，两者的标识空间不同，不能混在一个下拉里。
 */
const settings = ref(getTtsSettings());
const azureVoices = ref<AzureVoice[]>([]);
const systemVoices = ref<SpeechSynthesisVoice[]>([]);

const azureReady = computed(() => isAzureConfigured());

const langItems: { key: TtsLang; label: string }[] = [
  { key: 'zh-CN', label: 'voiceZh' },
  { key: 'en-US', label: 'voiceEn' },
];

/** 当前源是否能读这门语言 —— 不能读就该给家长提示，而不是等播出问题 */
function sourceCovers(lang: TtsLang): boolean {
  if (settings.value.source === 'system') return hasVoiceFor(lang);
  return azureReady.value;
}

function voiceOptions(lang: TtsLang) {
  if (settings.value.source === 'system') {
    return systemVoices.value
      .filter((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2)))
      .map((voice) => ({ label: voice.name, value: voice.name }));
  }
  return azureVoices.value
    .filter((voice) => voice.lang === lang)
    .map((voice) => ({ label: voice.name, value: voice.id }));
}

/** 提示保存失败：界面显示新值、存储里还是旧值的话，刷新就会回退且无从查起 */
function persist() {
  if (!saveTtsSettings(settings.value)) {
    message.error($t('parent.settings.voiceSaveFailed'));
  }
}

function onEnabledChange(checked: boolean | number | string) {
  settings.value = { ...settings.value, enabled: Boolean(checked) };
  // setTtsEnabled 会在关闭时停掉正在播放的语音，所以开关单独走它
  if (!setTtsEnabled(settings.value.enabled)) {
    message.error($t('parent.settings.voiceSaveFailed'));
  }
  message.success(
    settings.value.enabled
      ? $t('parent.settings.ttsOn')
      : $t('parent.settings.ttsOff'),
  );
}

function onSourceChange(value: unknown) {
  settings.value = { ...settings.value, source: value as TtsSource };
  // 两条通道的音色分开存，切换源不会丢另一边的选择，无需清空
  persist();
}

function onVoiceChange(lang: TtsLang, value: unknown) {
  const source = settings.value.source;
  settings.value = {
    ...settings.value,
    voices: {
      ...settings.value.voices,
      [source]: {
        ...settings.value.voices[source],
        [lang]: String(value ?? ''),
      },
    },
  };
  persist();
}

function onRateChange(value: number | number[]) {
  settings.value = { ...settings.value, rate: Number(value) };
  persist();
}

function onPitchChange(value: number | number[]) {
  settings.value = { ...settings.value, pitch: Number(value) };
  persist();
}

function currentVoice(lang: TtsLang): string {
  return settings.value.voices[settings.value.source][lang];
}

async function loadVoices() {
  systemVoices.value = window.speechSynthesis?.getVoices?.() ?? [];
  // Edge 的在线音色是异步就绪的，加载瞬间拿不到，补一次 voiceschanged
  window.speechSynthesis?.addEventListener?.(
    'voiceschanged',
    () => {
      systemVoices.value = window.speechSynthesis?.getVoices?.() ?? [];
    },
    { once: true },
  );

  if (!azureReady.value) return;
  try {
    azureVoices.value = await fetchAzureVoices();
  } catch {
    azureVoices.value = [];
  }
}

function sourceLabel(): string {
  return settings.value.source === 'azure'
    ? $t('parent.settings.sourceAzure')
    : $t('parent.settings.sourceSystem');
}

onMounted(loadVoices);
watch(() => settings.value.source, loadVoices);
</script>

<template>
  <Card :title="$t('parent.settings.voiceTitle')">
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <span class="text-base">{{ $t('parent.settings.tts') }}</span>
        <Switch
          :checked="settings.enabled"
          :checked-children="$t('parent.settings.on')"
          :un-checked-children="$t('parent.settings.off')"
          @change="onEnabledChange"
        />
      </div>

      <div class="flex items-center justify-between">
        <span class="text-base">{{ $t('parent.settings.voiceSource') }}</span>
        <Select
          class="w-44"
          :options="[
            { label: $t('parent.settings.sourceAzure'), value: 'azure' },
            { label: $t('parent.settings.sourceSystem'), value: 'system' },
          ]"
          :value="settings.source"
          @change="onSourceChange"
        />
      </div>

      <div v-for="item in langItems" :key="item.key">
        <div class="flex items-center justify-between">
          <span class="text-base">{{ $t(`parent.settings.${item.label}`) }}</span>
          <Select
            class="w-44"
            :options="[
              { label: $t('parent.settings.voiceDefault'), value: '' },
              ...voiceOptions(item.key),
            ]"
            :value="currentVoice(item.key)"
            @change="(value: unknown) => onVoiceChange(item.key, value)"
          />
        </div>
        <p v-if="!sourceCovers(item.key)" class="mt-1 text-xs text-red-500">
          {{
            $t('parent.settings.sourceUnavailable', { source: sourceLabel() })
          }}
        </p>
      </div>

      <div>
        <div class="mb-1 flex justify-between text-sm">
          <span>{{ $t('parent.settings.voiceRate') }}</span>
          <span class="text-muted-foreground">
            {{ settings.rate.toFixed(2) }}
          </span>
        </div>
        <Slider
          :max="1.5"
          :min="0.5"
          :step="0.05"
          :value="settings.rate"
          @change="onRateChange"
        />
      </div>

      <div>
        <div class="mb-1 flex justify-between text-sm">
          <span>{{ $t('parent.settings.voicePitch') }}</span>
          <span class="text-muted-foreground">{{ settings.pitch }}</span>
        </div>
        <Slider
          :max="50"
          :min="-50"
          :step="5"
          :value="settings.pitch"
          @change="onPitchChange"
        />
      </div>

      <p v-if="!azureReady" class="text-xs text-amber-500">
        {{ $t('parent.settings.azureNotConfigured') }}
      </p>
      <p v-if="!sourceCovers('zh-CN') && !sourceCovers('en-US')" class="text-xs text-red-500">
        {{ $t('parent.settings.allSourcesUnavailable') }}
      </p>
    </div>
  </Card>
</template>
