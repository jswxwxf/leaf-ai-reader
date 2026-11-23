import { describe, expect, it } from 'vitest';
import { createSentenceWrapper, splitSentences } from '../../src/utils/sentence';

describe('splitSentences', () => {
  it('splits English sentences while keeping decimal points, URLs and abbreviations intact', () => {
    expect(splitSentences('Dr. Smith paid 3.14. She visited example.com. “It worked.” She smiled.')).toEqual([
      'Dr. Smith paid 3.14.',
      'She visited example.com.',
      '“It worked.”',
      'She smiled.',
    ]);
  });
});

describe('createSentenceWrapper', () => {
  it('preserves the space between English sentences', () => {
    const sentenceWrapper = createSentenceWrapper();
    expect(sentenceWrapper('It was late. We went home.')).toBe(
      '<span class="sentence" id="s-1">It was late.</span> <span class="sentence" id="s-2">We went home.</span>'
    );
  });

  it('uses splitSentences and keeps sentence ids continuous across calls', () => {
    const sentenceWrapper = createSentenceWrapper();

    expect(sentenceWrapper('第一句。第二句。')).toBe(
      '<span class="sentence" id="s-1">第一句。</span><span class="sentence" id="s-2">第二句。</span>'
    );
    expect(sentenceWrapper('第三句。')).toBe(
      '<span class="sentence" id="s-3">第三句。</span>'
    );
  });
});
