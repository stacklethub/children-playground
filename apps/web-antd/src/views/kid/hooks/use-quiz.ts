import type { LearnModule } from '#/store';

import { ref } from 'vue';

import { useContent } from '#/data/use-content';
import { $t } from '#/locales';
import { useKidStore } from '#/store';
import { pinyinOf } from '#/utils/pinyin';
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

/** 英文乐园「考一考」的题目：认字母 或 认单词释义 */
export interface LetterQuizState extends QuizState<string> {
  /** 错题本条目标识始终用字母，方便按字母复习 */
  itemId: string;
  mode: 'letter' | 'word';
  word: string;
}

/**
 * 英文乐园：认字目 / 学单词 / 考一考 三模式共用。
 * 考一考混出两类题 —— 看字母选字母、看单词选释义。
 */
export function useLetterPractice() {
  const { letters } = useContent();

  function letterOptions(answer: string, count = 4) {
    const others = letters.value
      .filter((l) => l.letter !== answer)
      .toSorted(() => Math.random() - 0.5)
      .slice(0, count - 1)
      .map((l) => l.letter);
    return [answer, ...others].toSorted(() => Math.random() - 0.5);
  }

  function meaningOptions(answer: string, count = 3) {
    const others = letters.value
      .filter((l) => l.zh !== answer)
      .toSorted(() => Math.random() - 0.5)
      .slice(0, count - 1)
      .map((l) => l.zh);
    return [answer, ...others].toSorted(() => Math.random() - 0.5);
  }

  function createQuiz(): LetterQuizState {
    const pool = letters.value;
    // 难度范围理论上不会裁空，但池子为空时给出题也要有兜底
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!item) {
      return {
        answer: '',
        itemId: '',
        mode: 'letter',
        options: [],
        word: '',
      };
    }
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
   * 每次点击只朗读一次英文，中文释义与例句显示在卡片上即可。
   *
   * 走统一的 speak()，由家长设置的语音源决定走哪个通道 ——
   * 不要在模块里绕过设置直连某个在线接口，那会出现「家长设置了却仍走别的接口」。
   *
   * 不做「英文读完接中文」的串接 —— 串接要靠在 onEnd 里再调 speak()，
   * 而 speak() 会 cancel()，在 onend 回调中执行 cancel() 会让 Chrome
   * 的语音引擎卡死且不报错（表现为整个模块静音，要刷新页面才恢复）。
   */
  function sayLetter(item: { letter: string }) {
    speak(item.letter, { lang: 'en-US' });
  }

  function sayWord(item: { word: string }) {
    speak(item.word, { lang: 'en-US' });
  }

  return { createQuiz, sayLetter, sayWord };
}

/** 中文乐园「考一考」的题目：看拼音选汉字 或 看汉字选拼音 */
export interface PinyinQuizState extends QuizState<string> {
  /** 错题本条目标识始终用条目 id，方便按拼音条目复习 */
  itemId: string;
  emoji: string;
  mode: 'pickHanzi' | 'pickPinyin';
  /** 题干上显示的字形 */
  prompt: string;
}

/**
 * 中文乐园：学拼音 / 认汉字 / 考一考 三模式共用。
 * 考一考混出两类题 —— 看拼音选汉字、看汉字选拼音。
 */
export function usePinyinPractice() {
  const { pinyinList } = useContent();

  function hanziOptions(answer: string, count = 3) {
    const others = pinyinList.value
      .filter((p) => p.hanzi !== answer)
      .toSorted(() => Math.random() - 0.5)
      .slice(0, count - 1)
      .map((p) => p.hanzi);
    return [answer, ...others].toSorted(() => Math.random() - 0.5);
  }

  /** 选项是汉字读出来的完整拼音（「苹果」→ píng guǒ），不是声韵母 */
  function pinyinOptions(answer: string, count = 4) {
    const others = pinyinList.value
      .filter((p) => pinyinOf(p.hanzi) !== answer)
      .toSorted(() => Math.random() - 0.5)
      .slice(0, count - 1)
      .map((p) => pinyinOf(p.hanzi));
    return [answer, ...others].toSorted(() => Math.random() - 0.5);
  }

  function createQuiz(): PinyinQuizState {
    const pool = pinyinList.value;
    // 难度范围理论上不会裁空，但池子为空时给出题也要有兜底
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!item) {
      return {
        answer: '',
        emoji: '',
        itemId: '',
        mode: 'pickHanzi',
        options: [],
        prompt: '',
      };
    }
    const full = pinyinOf(item.hanzi);
    return Math.random() < 0.5
      ? {
          answer: item.hanzi,
          emoji: item.emoji,
          itemId: item.id,
          mode: 'pickHanzi',
          options: hanziOptions(item.hanzi),
          prompt: full,
        }
      : {
          answer: full,
          emoji: item.emoji,
          itemId: item.id,
          mode: 'pickPinyin',
          options: pinyinOptions(full),
          prompt: item.hanzi,
        };
  }

  /** 朗读例字：拼音字形是拉丁字母，交给中文语音会读成怪音 */
  function sayPinyin(item: undefined | { hanzi: string }) {
    if (!item) return;
    speak(item.hanzi, { lang: CONTENT_TTS_LANG });
  }

  return { createQuiz, sayPinyin };
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
    return [...set].toSorted(() => Math.random() - 0.5);
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
    return [...set].toSorted(() => Math.random() - 0.5);
  }

  function createQuiz(): QuizState<number> & { emoji: string } {
    const pool = numbers.value;
    const item = pool[Math.floor(Math.random() * pool.length)];
    // 难度范围可能把池子裁空；空池时没有可出的题，直接抛错而不是出一张空题
    if (!item) throw new TypeError('数字王国内容池为空，无法出题');
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
