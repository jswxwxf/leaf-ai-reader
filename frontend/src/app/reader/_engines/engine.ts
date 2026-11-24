/** 单句朗读所需的文本、会话检查和播放回调。 */
export interface SpeakOptions {
  /** 已由引擎处理、可直接朗读的文本。 */
  text: string;
  /** 检查本次朗读是否仍有效，供延迟回调在执行前确认。 */
  isCurrentSession: () => boolean;
  /** 引擎提供词边界时触发，用于词级高亮。 */
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  /** 这一句自然播放结束时触发。 */
  onEnd: () => void;
  /** 引擎报告合成或播放失败时触发。 */
  onError: (error: unknown) => void;
}

/** 阅读器共用的单句朗读引擎接口。 */
export interface SpeechEngine {
  /** 从正文句子提取并准备朗读文本。 */
  getText(sentence: HTMLElement): string;
  /** 启动单句朗读，播放完成以 onEnd 回调为准。 */
  speak(options: SpeakOptions): void | Promise<void>;
  /** 支持预合成的引擎可提前准备一句音频。 */
  prepare?(text: string): Promise<boolean>;
  /** 停止播放，并避免待处理的音频继续出声。 */
  stop(): void;
}
