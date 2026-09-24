/**
 * 语音引导工具（Web Speech API）
 * 宝宝端所有页面通过 speak() 朗读引导语，可在设置中关闭。
 */

const TTS_ENABLED_KEY = 'child-study-tts-enabled';

/** 是否启用语音（独立于 store，避免循环依赖） */
export function isTtsEnabled(): boolean {
  return localStorage.getItem(TTS_ENABLED_KEY) !== '0';
}

export function setTtsEnabled(enabled: boolean) {
  localStorage.setItem(TTS_ENABLED_KEY, enabled ? '1' : '0');
  if (!enabled) {
    stopSpeak();
  }
}

/** 优先挑选中文语音 */
function pickChineseVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.lang === 'zh-CN') ?? voices.find((v) => v.lang.startsWith('zh'));
}

/**
 * 朗读文本。语音未启用或浏览器不支持时静默降级。
 */
export function speak(
  text: string,
  options: { onEnd?: () => void; rate?: number } = {},
) {
  if (!isTtsEnabled()) {
    options.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) {
    options.onEnd?.();
    return;
  }
  try {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = options.rate ?? 0.85;
    const voice = pickChineseVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
    synth.speak(utterance);
  } catch {
    options.onEnd?.();
  }
}

/** 停止当前朗读 */
export function stopSpeak() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}

/** 随机读取一句鼓励语 */
const PRAISE = ['答对啦，真棒！', '太厉害了！', '你真聪明！', '好厉害呀，继续加油！', '哇，完全正确！'];

export function speakPraise() {
  speak(PRAISE[Math.floor(Math.random() * PRAISE.length)]!, { rate: 0.95 });
}

const ENCOURAGE = ['没关系，再试一次！', '差一点点哦，再来！', '加油，你可以的！'];

export function speakEncourage() {
  speak(ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]!, { rate: 0.95 });
}
