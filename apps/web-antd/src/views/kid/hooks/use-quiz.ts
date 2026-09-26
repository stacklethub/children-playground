import { ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { type LearnModule, useKidStore } from '#/store';
import { CONTENT_TTS_LANG, speak } from '#/utils/tts';

import { useCurrentChild } from './use-current-child';
import { useReward } from './use-reward';

export interface QuizState<T extends number | string> {
  answer: T;
  options: T[];
}

/**
 * 「考一考」通用测验逻辑：随机出题、判分、答对加星后自动出下一题。
 *
 * 答错写入错题本、答对移出，与 pinyin-vue 的闭环一致（见 store 的 wrongBook）。
 */
export function useQuiz<T extends number | string>(options: {
  /** 每答对一题获得的星星 */
  stars?: number;
  /** 生成题目 */
  create: () => QuizState<T>;
  /** 朗读题目 */
  ask: (quiz: QuizState<T>) => void;
  /** 记录所属模块 */
  module: LearnModule;
  /** 题目在错题本里的条目 id；默认取 answer 的字符串形式 */
  itemIdOf?: (quiz: QuizState<T>) => string;
}) {
  const { reward, wrong } = useReward();
  const kidStore = useKidStore();
  const { childId } = useCurrentChild();
  const quiz = ref<QuizState<T>>();
  const quizCount = ref(0);

  function next() {
    const created = options.create();
    quiz.value = created;
    quizCount.value += 1;
    options.ask(created);
  }

  function pick(value: T) {
    const current = quiz.value;
    if (!current) return;
    // 未绑定孩子时不写错题本（页面此时显示的是引导页）
    const child = childId.value;
    const itemId = options.itemIdOf?.(current) ?? `${current.answer}`;

    if (value === current.answer) {
      if (child) {
        kidStore.removeWrong(child, options.module, itemId);
      }
      reward({
        detail: `${current.answer}`,
        itemId,
        module: options.module,
        stars: options.stars ?? 2,
      });
      setTimeout(next, 1400);
    } else {
      if (child) {
        kidStore.addWrong(child, options.module, itemId);
      }
      wrong();
    }
  }

  return { next, pick, quiz, quizCount };
}

/**
 * 字母乐园：学一学朗读 + 考一考出题。
 */
export function useLetterPractice() {
  const { letters } = useContent();

  function letterOptions(answer: string, count = 4) {
    const others = letters.value
      .filter((l) => l.letter !== answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, count - 1)
      .map((l) => l.letter);
    return [answer, ...others].sort(() => Math.random() - 0.5);
  }

  function createQuiz(): QuizState<string> {
    const pool = letters.value;
    const item = pool[Math.floor(Math.random() * pool.length)]!;
    return { answer: item.letter, options: letterOptions(item.letter) };
  }

  function askQuiz(quiz: QuizState<string>) {
    speak($t('kid.tts.lettersQuiz', { letter: quiz.answer }));
  }

  function sayLetter(item: { letter: string; word: string; zh: string }) {
    // 字母释义属于内容层中文素材，固定中文语音
    speak(
      $t('kid.tts.lettersSay', {
        letter: item.letter,
        word: item.word,
        zh: item.zh,
      }),
      { lang: CONTENT_TTS_LANG },
    );
  }

  return { createQuiz, askQuiz, sayLetter };
}

/**
 * 数字小屋：学一学朗读 + 考一考出题。
 */
export function useNumberPractice() {
  const { numbers } = useContent();

  function numberOptions(answer: number, count = 3) {
    const set = new Set<number>([answer]);
    while (set.size < count) {
      set.add(1 + Math.floor(Math.random() * 10));
    }
    return [...set].sort(() => Math.random() - 0.5);
  }

  function createQuiz(): QuizState<number> & { emoji: string } {
    const pool = numbers.value;
    const item = pool[Math.floor(Math.random() * pool.length)]!;
    return {
      answer: item.count,
      emoji: item.emoji,
      options: numberOptions(item.count),
    };
  }

  function askQuiz() {
    speak($t('kid.tts.numbersQuiz'));
  }

  function sayNumber(item: { num: number; word: string }) {
    // 数字汉字属于内容层中文素材，固定中文语音
    const list = Array.from({ length: item.num }, () => item.word).join('，');
    speak($t('kid.tts.numbersSay', { word: item.word, list }), {
      lang: CONTENT_TTS_LANG,
    });
  }

  return { askQuiz, createQuiz, sayNumber };
}
