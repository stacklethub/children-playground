import { ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { speak } from '#/utils/tts';

import { useReward } from './use-reward';

export interface QuizState<T extends number | string> {
  answer: T;
  options: T[];
}

/**
 * 「考一考」通用测验逻辑：随机出题、判分、答对加星后自动出下一题。
 */
export function useQuiz<T extends number | string>(options: {
  /** 每答对一题获得的星星 */
  stars?: number;
  /** 生成题目 */
  create: () => QuizState<T>;
  /** 朗读题目 */
  ask: (quiz: QuizState<T>) => void;
  /** 记录所属模块 */
  module: 'letters' | 'numbers';
}) {
  const { reward, wrong } = useReward();
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
    if (value === current.answer) {
      reward({
        detail: `${current.answer}`,
        itemId: `${current.answer}`,
        module: options.module,
        stars: options.stars ?? 2,
      });
      setTimeout(next, 1400);
    } else {
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
    speak(
      $t('kid.tts.lettersSay', {
        letter: item.letter,
        word: item.word,
        zh: item.zh,
      }),
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
    const list = Array.from({ length: item.num }, () => item.word).join('，');
    speak($t('kid.tts.numbersSay', { word: item.word, list }));
  }

  return { askQuiz, createQuiz, sayNumber };
}
