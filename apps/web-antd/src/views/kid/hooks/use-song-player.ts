import { computed, onMounted, ref } from 'vue';

import { $t } from '#/locales';
import { CONTENT_TTS_LANG, speak, stopSpeak } from '#/utils/tts';

import { useReward } from './use-reward';

/**
 * 儿歌播放器：逐行朗读歌词并高亮当前行，整首听完计星（按天去重）。
 */
export function useSongPlayer(
  song: () => undefined | { id: string; lines: string[]; title: string },
) {
  const { reward } = useReward();

  const activeLine = ref(-1);
  const playing = ref(false);
  const listenedKeys = new Set<string>();

  const title = computed(() => song()?.title);

  function stop() {
    stopSpeak();
    activeLine.value = -1;
    playing.value = false;
  }

  function play() {
    const current = song();
    if (!current) return;
    playing.value = true;
    let i = 0;
    const speakLine = () => {
      if (i >= current.lines.length) {
        stop();
        const key = `${current.id}-${new Date().toDateString()}`;
        if (listenedKeys.has(key)) {
          speak($t('kid.tts.songRetry'));
        } else {
          listenedKeys.add(key);
          reward({
            detail: current.title,
            itemId: current.id,
            module: 'songs',
            stars: 2,
          });
        }
        return;
      }
      activeLine.value = i;
      // 歌词属于内容层中文素材（不参与 i18n），固定中文语音朗读
      speak(current.lines[i]!, {
        lang: CONTENT_TTS_LANG,
        onEnd: () => {
          i += 1;
          speakLine();
        },
      });
    };
    speakLine();
  }

  /** 点击某一行单独朗读 */
  function speakLine(index: number) {
    const line = song()?.lines[index];
    if (!line) return;
    activeLine.value = index;
    speak(line, { lang: CONTENT_TTS_LANG });
  }

  onMounted(() => {
    if (song()) {
      play();
    } else {
      speak($t('kid.tts.songsIntro'));
    }
  });

  return { activeLine, play, playing, speakLine, stop, title };
}
