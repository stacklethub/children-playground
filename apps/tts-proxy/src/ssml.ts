import type { TtsLang } from './voices';

export interface SynthRequest {
  lang: TtsLang;
  pitch: number;
  rate: number;
  text: string;
  voice: string;
}

/** 倍率 → Azure 相对百分比，如 0.9 → "-10%" */
export function rateToProsody(rate: number): string {
  return formatPercent(Math.round((rate - 1) * 100));
}

export function pitchToProsody(pitch: number): string {
  return formatPercent(Math.round(pitch));
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

/** 文本里的 & < > " ' 必须转义，否则 SSML 解析失败 */
function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSsml(request: SynthRequest): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${request.lang}">` +
    `<voice name="${request.voice}">` +
    `<prosody rate="${rateToProsody(request.rate)}" pitch="${pitchToProsody(request.pitch)}">` +
    `${escapeXml(request.text)}` +
    `</prosody></voice></speak>`
  );
}
