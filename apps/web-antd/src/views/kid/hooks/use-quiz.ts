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
  /** 记录所属模块；传函数时按题实时取（闯关冒险一关可混合多个模块） */
  module: (() => LearnModule) | LearnModule;
  /** 题目在错题本里的条目 id；默认取 answer 的字符串形式 */
  itemIdOf?: (quiz: QuizState<T>) => string;
  /** 答对计分后的回调（闯关冒险用它推进关卡进度） */
  onCorrect?: () => void;
  /** 答错后的回调（闯关冒险用它扣心） */
  onWrong?: () => void;
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
    const moduleKey =
      typeof options.module === 'function' ? options.module() : options.module;

    if (value === current.answer) {
      if (child) {
        kidStore.removeWrong(child, moduleKey, itemId);
      }
      reward({
        detail: `${current.answer}`,
        itemId,
        module: moduleKey,
        stars: options.stars ?? 2,
      });
      options.onCorrect?.();
      setTimeout(next, 1400);
    } else {
      if (child) {
        kidStore.addWrong(child, moduleKey, itemId);
      }
      wrong();
      options.onWrong?.();
    }
  }

  return { next, pick, quiz, quizCount };
}

/** 字母乐园「考一考」的题目：认字母 或 认单词释义 */
export interface LetterQuizState extends QuizState<string> {
  /** 错题本条目标识始终用字母，方便按字母复习 */
  itemId: string;
  mode: 'letter' | 'word';
  word: string;
}

/**
 * 字母乐园：学一学 / 认单词 / 考一考 三模式共用。
 * 考一考混出两类题 —— 看字母选字母、看单词选释义。
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

  function meaningOptions(answer: string, count = 3) {
    const others = letters.value
      .filter((l) => l.zh !== answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, count - 1)
      .map((l) => l.zh);
    return [answer, ...others].sort(() => Math.random() - 0.5);
  }

  function createQuiz(): LetterQuizState {
    const pool = letters.value;
    // 难度范围理论上不会裁空，但池子为空时给出题也要有兜底
    if (pool.length === 0) {
      return {
        answer: '',
        itemId: '',
        mode: 'letter',
        options: [],
        word: '',
      };
    }
    const item = pool[Math.floor(Math.random() * pool.length)]!;
    const asWord = Boolean(item.zh) && Math.random() < 0.5;
    return asWord
      ? {
          answer: item.zh,
          itemId: item.letter,
          mode: 'word',
          options: meaningOptions(item.zh),
          word: item.word,
        }
      : {
          answer: item.letter,
          itemId: item.letter,
          mode: 'letter',
          options: letterOptions(item.letter),
          word: item.word,
        };
  }

  /**
   * 每次点击只朗读一次，不做「英文读完接着读中文」的串接。
   *
   * 串接要靠在 onEnd 里再调 speak()，而 speak() 默认先 cancel()——
   * 在 onend 回调中执行 cancel() 会让 Chrome 的语音引擎卡死且不报错
   * （表现为整个模块静音，要刷新页面才恢复）。单句朗读与其它模块
   * 走的是同一条路径，不存在这个风险；中文释义显示在卡片上即可。
   */
  function sayLetter(item: { letter: string; lower: string; word: string }) {
    speak(`${item.letter} ${item.lower}, ${item.word}`, { lang: 'en-US' });
  }

  function sayWord(item: { word: string; sentence: string }) {
    speak(`${item.word}. ${item.sentence}`, { lang: 'en-US' });
  }

  return { createQuiz, sayLetter, sayWord };
}

/**
 * 数字王国「算一算」：10 以内加减。
 * 算式上限受家长端「难度区间」约束（moduleRange），与「认一认」共用同一设定。
 */
export function useArithmeticPractice() {
  const kidStore = useKidStore();

  /** 上界取难度区间，但至少 2（否则出不了加减题），最多 10 */
  function limit() {
    return Math.min(Math.max(kidStore.moduleRange('numbers'), 2), 10);
  }

  /** 围绕正确答案取干扰项，都落在 [0, max] 内 */
  function optionsAround(answer: number, max: number, count = 3) {
    const set = new Set<number>([answer]);
    let guard = 0;
    while (set.size < count && guard < 50) {
      guard += 1;
      const candidate = answer + (Math.floor(Math.random() * 5) - 2);
      if (candidate >= 0 && candidate <= max) set.add(candidate);
    }
    return [...set].sort(() => Math.random() - 0.5);
  }

  function createQuiz(): QuizState<number> & {
    expr: string;
    isMinus: boolean;
    left: number;
    right: number;
  } {
    const max = limit();
    // 保证 a + b <= max，减法则由 a + b 反推，结果天然非负
    const a = 1 + Math.floor(Math.random() * (max - 1));
    const b = 1 + Math.floor(Math.random() * (max - a + 1));
    const isMinus = Math.random() < 0.4;
    const left = isMinus ? a + b : a;
    const right = b;
    const answer = isMinus ? a : a + b;

    return {
      answer,
      expr: `${left} ${isMinus ? '−' : '+'} ${right}`,
      isMinus,
      left,
      options: optionsAround(answer, max),
      right,
    };
  }

  return { createQuiz };
}

/**
 * 数字王国：认一认朗读 + 玩一玩数数出题。
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
