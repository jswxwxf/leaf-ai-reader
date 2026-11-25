const maxSegmentLength = 160;
const pausePunctuation = /[,;:!?，；：！？。]/u;

/**
 * 将长句拆成适合逐段合成的文本，每段最多 160 个 Unicode 码点。
 * 标点和空白都会保留，因此分段结果用 join("") 拼接后等于原文。
 *
 * 示例：
 * - splitSpeechText("Hello, world.") 返回 ["Hello, world."]，短句无需拆分。
 * - splitSpeechText("word ".repeat(20) + "then, " + "next ".repeat(20))
 *   在 then 后的逗号处拆开，逗号留在第一段，紧跟的空格留在第二段。
 * - splitSpeechText("word ".repeat(33)) 按空格拆成 32 个 "word " 和最后一个 "word "。
 * - splitSpeechText("a".repeat(161)) 没有标点或空白，拆成 160 个 a 和最后一个 a。
 */
export function splitSpeechText(text: string): string[] {
  // 先按 Unicode 码点展开，切分时不会把 😀 这样的字符拆成两半。
  const characters = Array.from(text);
  const segments: string[] = [];
  let offset = 0;

  while (characters.length - offset > maxSegmentLength) {
    const window = characters.slice(offset, offset + maxSegmentLength);
    // 优先在窗口后半段找停顿标点，避免把一句话拆成过短的片段。
    const pauseIndex = window.findLastIndex((character, index) => {
      const inSecondHalf = index >= window.length / 2;
      if (!inSecondHalf || !pausePunctuation.test(character)) return false;

      // 标点可能正好在窗口末尾，所以下一个字符从原文里取。
      const nextCharacter = characters[offset + index + 1];
      return /\s/u.test(nextCharacter);
    });
    const spaceIndex = window.findLastIndex((character) => /\s/u.test(character));
    // 没有可用标点时按空白拆。遇到超长单词才按字符上限截断。
    const boundary = pauseIndex >= 0 ? pauseIndex : spaceIndex;
    const length = boundary < 0 ? maxSegmentLength : boundary + 1;
    segments.push(window.slice(0, length).join(""));
    offset += length;
  }

  // 剩余文本已在长度上限内，直接作为最后一段。
  if (offset < characters.length) segments.push(characters.slice(offset).join(""));
  return segments;
}
