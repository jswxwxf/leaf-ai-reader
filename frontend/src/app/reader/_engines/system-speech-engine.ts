import { showToast } from "@/app/global-toasts";
import { delay, isSafari } from "../_utils/utils";
import type { SpeakOptions, SpeechEngine } from "./engine";

/**
 * 清洗 TTS 输入文本，过滤引文序号、emoji 和不适合直接朗读的符号。
 */
export function sanitizeSpeechText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/https?:\/\//g, (m) => " ".repeat(m.length))
    .replace(/\[\d+\]|〔\d+〕|【\d+】|\(\d+\)|[①-⑳⑴-⒇]/g, (m) => " ".repeat(m.length))
    .replace(/([0-9])\uFE0F?\u20E3/g, (m, digit: string) => digit + " ".repeat(m.length - digit.length))
    .replace(/\p{Extended_Pictographic}/gu, (m) => " ".repeat(m.length))
    .replace(/<([^<>]{1,120})>/g, (_m, inner: string) => ` ${inner} `)
    .replace(/""/g, "， ")
    .replace(/["']/g, " ")
    .replaceAll("——", "， ")
    .replace(/”“|」「|》《/g, "”，");
}

/**
 * 获取元素的文本内容，并将特定标签（如 sup, sub）的内容替换为等长空格。
 * 目的是在 TTS 朗读时静音跳过这些引文，同时保持字符偏移量不变，确保高亮精准。
 */
function getTextWithMasking(node: Node): string {
  let text = "";

  // 通过 for...of 配合 continue 扁平化处理逻辑，消除嵌套深坑
  for (const child of Array.from(node.childNodes)) {
    // 1. 处理纯文本节点
    if (child.nodeType === Node.TEXT_NODE) {
      text += sanitizeSpeechText(child.textContent || "");
      continue;
    }

    // 2. 忽略非元素节点
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    // 3. 处理注脚类标签 (SUP/SUB)
    const isNote = child.nodeName === "SUP" || child.nodeName === "SUB";
    if (isNote) {
      const content = child.textContent || "";
      // 智能阈值：文字够长则清洗后朗读，较短（通常为序号）则静音填充
      text +=
        content.length > 8 ? sanitizeSpeechText(content) : " ".repeat(content.length);
      continue;
    }

    // 4. 处理普通元素节点（递归）
    text += getTextWithMasking(child);
  }

  return text.toLowerCase();
}

export function configureSpeech(utterance: SpeechSynthesisUtterance) {
  utterance.lang = "zh-CN";
  // Safari 的朗读倍速基准与 Chrome/Edge 不同。
  utterance.rate = isSafari ? 1.32 : 2;
}

/**
 * 伪代码：
 *
 * speakWithRetry(text):
 *   expectedIndex = 找到这句话第一个真正应该朗读的字符
 *
 *   speakAttempt(attempt):
 *     创建一个新的 utterance
 *
 *     onboundary(event):
 *       如果这是第一个 boundary，且 event.charIndex 明显晚于 expectedIndex:
 *         cancel 当前 utterance
 *         等一小会
 *         用同一句话再试一次
 *         return
 *       交给外层做词级高亮
 *
 *     onend():
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
 * 注意：当前朗读会话是否有效由 use-speech.ts 负责，这里只负责 retry 判断。
 */

const MAX_RETRY_COUNT = 2;
const BOUNDARY_TOLERANCE = 1;
const MIN_RETRY_TEXT_LENGTH = 6;

interface SpeakWithRetryOptions extends SpeakOptions {
  enabled: boolean;
  configure?: (utterance: SpeechSynthesisUtterance) => void;
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
 * 此函数只负责检测异常起点并重试当前 utterance, 不处理阅读器状态推进。
 */
function speakWithRetry({
  enabled,
  text,
  isCurrentSession,
  configure,
  onBoundary,
  onEnd,
}: SpeakWithRetryOptions) {
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

      if (isCurrentSession()) {
        speakAttempt(attempt + 1);
      }

      return true;
    };

    utterance.onstart = () => {
      startTime = performance.now();
    };

    utterance.onboundary = (event) => {
      if (!isCurrentSession() || retrying) return;

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
      if (!isCurrentSession() || retrying) return;

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
}

export const systemSpeechEngine: SpeechEngine = {
  getText: getTextWithMasking,
  speak(options) {
    speakWithRetry({ ...options, enabled: isSafari, configure: configureSpeech });
  },
  stop() {
    window.speechSynthesis?.cancel();
  },
};
