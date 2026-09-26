/**
 * 精选音色白名单。
 *
 * 单一事实来源：前端下拉从 GET /voices 拉取，POST /tts 也用它做校验，
 * 避免前后端各存一份常量后漂移。
 */

export type TtsLang = 'en-US' | 'zh-CN';

export interface AzureVoice {
  id: string;
  lang: TtsLang;
  name: string;
}

export const VOICES: AzureVoice[] = [
  { id: 'zh-CN-XiaoxiaoNeural', lang: 'zh-CN', name: '晓晓 Xiaoxiao（女）' },
  { id: 'zh-CN-XiaoyiNeural', lang: 'zh-CN', name: '晓伊 Xiaoyi（女）' },
  { id: 'zh-CN-YunxiNeural', lang: 'zh-CN', name: '云希 Yunxi（男）' },
  { id: 'zh-CN-YunjianNeural', lang: 'zh-CN', name: '云健 Yunjian（男）' },
  { id: 'zh-CN-YunyangNeural', lang: 'zh-CN', name: '云扬 Yunyang（男）' },
  { id: 'en-US-AvaNeural', lang: 'en-US', name: 'Ava（女）' },
  { id: 'en-US-EmmaNeural', lang: 'en-US', name: 'Emma（女）' },
  { id: 'en-US-AriaNeural', lang: 'en-US', name: 'Aria（女）' },
  { id: 'en-US-AndrewNeural', lang: 'en-US', name: 'Andrew（男）' },
  { id: 'en-US-BrianNeural', lang: 'en-US', name: 'Brian（男）' },
  { id: 'en-US-GuyNeural', lang: 'en-US', name: 'Guy（男）' },
];

export function findVoice(id: string): AzureVoice | undefined {
  return VOICES.find((voice) => voice.id === id);
}
