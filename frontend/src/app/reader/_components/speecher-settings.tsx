import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { MessageSquareQuote, AlignLeft, FileText, Check } from "lucide-react";
import { useReaderStore, type SpeechLanguage } from "../_store/store";
import { requestSpeechLanguage } from "./speech-initializer";

const modeIcons = {
  sentence: MessageSquareQuote,
  paragraph: AlignLeft,
  article: FileText,
};

/**
 * 语音播放设置组件 (SpeecherSettings)
 * 包含朗读模式选择（逐句、逐段、全文）
 */
export function SpeecherSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { speechMode, setSpeechMode, language, setLanguage } = useReaderStore(useShallow((state) => ({
    speechMode: state.speechMode,
    setSpeechMode: state.setSpeechMode,
    language: state.language,
    setLanguage: state.setLanguage,
  })));

  const handleModeSelect = (mode: 'sentence' | 'paragraph' | 'article') => {
    // 只有用户切换朗读模式时才修改 URL，避免正文和朗读状态更新打断翻章。
    const url = new URL(window.location.href);
    if (url.searchParams.get('speechMode') !== mode) {
      url.searchParams.set('speechMode', mode);
      window.history.replaceState(null, '', url);
    }
    setSpeechMode(mode);
    setIsOpen(false);
  };

  const handleLanguageSelect = async (nextLanguage: SpeechLanguage) => {
    setIsOpen(false);
    if (nextLanguage === language) return;

    const isReady = await requestSpeechLanguage(nextLanguage);
    if (isReady) setLanguage(nextLanguage);
  };

  const ModeIcon = modeIcons[speechMode];

  return (
    <>
      {/* 透明遮罩层，用于点击外部关闭菜单 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`dropdown dropdown-top dropdown-center join-item ${isOpen ? 'dropdown-open' : 'dropdown-close'}`}>
        <label
          className="btn btn-ghost h-[52px] rounded-r-2xl px-3 border-none hover:bg-primary/10 flex items-center gap-1 text-primary cursor-pointer relative z-50"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ModeIcon className="w-4 h-4" />
        </label>
        <div
          className="dropdown-content p-2 shadow-2xl bg-base-100 rounded-2xl w-44 mb-4 border border-base-200 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50"
        >
          <ul className="menu w-full p-0">
            <li>
              <a
                className={`py-3 rounded-xl transition-colors flex items-center gap-2 ${speechMode === 'sentence' ? 'bg-primary/10 text-primary font-bold' : ''}`}
                onClick={() => handleModeSelect('sentence')}
              >
                <div className="w-5 flex justify-center">
                  {speechMode === 'sentence' && <Check className="w-4 h-4" />}
                </div>
                <MessageSquareQuote className="w-4 h-4 opacity-70" />
                <span>逐句朗读</span>
              </a>
            </li>
            <li>
              <a
                className={`py-3 rounded-xl transition-colors flex items-center gap-2 ${speechMode === 'paragraph' ? 'bg-primary/10 text-primary font-bold' : ''}`}
                onClick={() => handleModeSelect('paragraph')}
              >
                <div className="w-5 flex justify-center">
                  {speechMode === 'paragraph' && <Check className="w-4 h-4" />}
                </div>
                <AlignLeft className="w-4 h-4 opacity-70" />
                <span>逐段朗读</span>
              </a>
            </li>
            <li>
              <a
                className={`py-3 rounded-xl transition-colors flex items-center gap-2 ${speechMode === 'article' ? 'bg-primary/10 text-primary font-bold' : ''}`}
                onClick={() => handleModeSelect('article')}
              >
                <div className="w-5 flex justify-center">
                  {speechMode === 'article' && <Check className="w-4 h-4" />}
                </div>
                <FileText className="w-4 h-4 opacity-70" />
                <span>全文朗读</span>
              </a>
            </li>
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-base-200 px-2 pt-1">
            <span className="whitespace-nowrap text-xs text-base-content/60">朗读语言</span>
            <div role="group" aria-label="朗读语言" className="join shrink-0 bg-base-200/60">
              {([
                { value: "zh-CN", label: "中文" },
                { value: "en-US", label: "英文" },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={language === value}
                  className={`btn btn-ghost btn-xs join-item min-h-11 min-w-11 border-none px-2 ${language === value ? "bg-primary/10 text-primary" : "text-base-content/70"}`}
                  onClick={() => handleLanguageSelect(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
