import { useCallback, useRef } from "react";
import { showToast } from "@/app/global-toasts";
import { delay } from "../_utils/utils";

/**
 * 伪代码：
 *
 * speakWithRetry(text):
 *   sessionId = 新的朗读会话号
 *   expectedIndex = 找到这句话第一个真正应该朗读的字符
 *
 *   speakAttempt(attempt):
 *     创建一个新的 utterance
 *
 *     onboundary(event):
 *       如果这不是当前会话，忽略
 *       如果这是第一个 boundary，且 event.charIndex 明显晚于 expectedIndex:
 *         cancel 当前 utterance
 *         等一小会
 *         用同一句话再试一次
 *         return
 *       交给外层做词级高亮
 *
 *     onend():
 *       如果这不是当前会话，忽略
 *       如果没有收到 boundary，且结束得太快:
 *         认为 Safari 可能跳过了这句
 *         cancel 当前 utterance
 *         等一小会
 *         用同一句话再试一次
 *         return
 *       交给外层推进下一句
 *
 *     speechSynthesis.speak(utterance)
 *
 * cancelSpeechRetry():
 *   递增会话号，让旧 utterance 的异步回调全部失效
 */

const MAX_RETRY_COUNT = 2;
const BOUNDARY_TOLERANCE = 1;
const MIN_RETRY_TEXT_LENGTH = 6;

interface SpeakWithRetryOptions {
  text: string;
  configure?: (utterance: SpeechSynthesisUtterance) => void;
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  onEnd: () => void;
}

interface UseSpeechRetryOptions {
  enabled: boolean;
}

type RetryReason = "boundary" | "fast-end";

function findFirstSpeakableIndex(text: string): number {
  let index = 0;

  for (const char of text) {
    // 跳过句首空格、标点、符号等内容，避免把引号/括号误判为必须朗读的起点。
    if (/[^\p{P}\p{S}\s\p{Extended_Pictographic}]/u.test(char)) {
      return index;
    }
    index += char.length;
  }

  return 0;
}

function getSpeakableLength(text: string): number {
  return Array.from(text).filter((char) =>
    /[^\p{P}\p{S}\s\p{Extended_Pictographic}]/u.test(char)
  ).length;
}

function shouldRetryBoundary(event: SpeechSynthesisEvent, expectedIndex: number) {
  // 第一次 boundary 如果已经越过句首，Safari 很可能吃掉了前几个字。
  return event.charIndex > expectedIndex + BOUNDARY_TOLERANCE;
}

function shouldRetryFastEnd(text: string, sawBoundary: boolean, elapsedMs: number) {
  if (sawBoundary || getSpeakableLength(text) < MIN_RETRY_TEXT_LENGTH) {
    return false;
  }

  // 没有收到 boundary 且很快结束，通常是 Safari 直接跳过了这句。
  const minimumExpectedMs = Math.min(900, Math.max(350, text.length * 25));
  return elapsedMs < minimumExpectedMs;
}

/**
 * Safari 的 speechSynthesis 队列偶尔会跳过句子或吃掉句首。
 * 这个 hook 只负责检测异常起点并重试当前 utterance, 不处理阅读器状态推进。
 */
export function useSpeechRetry({ enabled }: UseSpeechRetryOptions) {
  const sessionRef = useRef(0);

  const cancelSpeechRetry = useCallback(() => {
    sessionRef.current += 1;
  }, []);

  const speakWithRetry = useCallback(
    ({
      text,
      configure,
      onBoundary,
      onEnd,
    }: SpeakWithRetryOptions) => {
      const sessionId = (sessionRef.current += 1);
      const expectedIndex = findFirstSpeakableIndex(text);

      const speakAttempt = (attempt: number) => {
        const utterance = new SpeechSynthesisUtterance(text);
        let sawBoundary = false;
        let retrying = false;
        let startTime = performance.now();

        configure?.(utterance);

        // 只在 Safari 等启用场景重试，并限制次数，避免单句异常时卡住整篇朗读。
        const canRetry = () =>
          enabled && !retrying && attempt < MAX_RETRY_COUNT;

        const retry = async (reason: RetryReason) => {
          retrying = true;
          window.speechSynthesis.cancel();
          showToast({
            type: "warning",
            message: `TTS retry #${attempt + 1}: ${reason}`,
            duration: 1800,
          });
          // 给 Safari 一点时间清理旧 utterance 队列，重试次数越多等待越久。
          await delay(80 * (attempt + 1));

          if (sessionRef.current === sessionId) {
            speakAttempt(attempt + 1);
          }

          return true;
        };

        utterance.onstart = () => {
          startTime = performance.now();
        };

        utterance.onboundary = (event) => {
          if (sessionRef.current !== sessionId || retrying) return;

          // 只用第一个 boundary 判断起点；之后的 boundary 继续交给词级高亮。
          if (
            canRetry() &&
            !sawBoundary &&
            shouldRetryBoundary(event, expectedIndex)
          ) {
            retry("boundary");
            return;
          }

          sawBoundary = true;
          onBoundary?.(event);
        };

        utterance.onend = () => {
          if (sessionRef.current !== sessionId || retrying) return;

          const elapsedMs = performance.now() - startTime;
          // 如果疑似跳句，重试当前句，不触发外层 onEnd 推进到下一句。
          if (canRetry() && shouldRetryFastEnd(text, sawBoundary, elapsedMs)) {
            retry("fast-end");
            return;
          }

          onEnd();
        };

        window.speechSynthesis.speak(utterance);
      };

      speakAttempt(0);
    },
    [enabled]
  );

  return { speakWithRetry, cancelSpeechRetry };
}
