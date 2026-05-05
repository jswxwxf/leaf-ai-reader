'use client';

import { type MouseEvent, type ReactNode, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { isSafari } from '../_utils/utils';

interface Props {
  children: ReactNode;
}

export function SpeechBox({ children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const handleSpeak = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const text = rootRef.current?.innerText.trim();
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = isSafari ? 1.3 : 2;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div ref={rootRef} className="relative">
      {children}
      <button
        type="button"
        aria-label="朗读"
        title="朗读"
        onClick={handleSpeak}
        className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-base-300/70 bg-base-100/80 p-0 text-base-content/55 shadow-sm"
      >
        <Volume2 className="h-4 w-4" />
        <span className="absolute -inset-3" aria-hidden="true" />
      </button>
    </div>
  );
}
