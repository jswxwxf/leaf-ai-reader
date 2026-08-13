import { describe, expect, it } from 'vitest';
import { createSentenceWrapper } from '../../src/utils/sentence';

describe('createSentenceWrapper', () => {
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
