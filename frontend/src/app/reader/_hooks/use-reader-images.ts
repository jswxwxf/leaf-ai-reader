import { useEffect, type RefObject } from 'react';
import { request } from '../../../lib/request';
import styles from '../_components/content.module.css';

const OCR_IMAGE_MIN_WIDTH = 180;
const OCR_IMAGE_MIN_HEIGHT = 100;

// 将图片地址拆成后端 OCR 接口需要的载荷：
// 书籍资源图片传 bookId/path，网页或外链图片保留原始 url。
const parseImageSource = (src: string) => {
  try {
    const url = new URL(src, window.location.origin);
    if (url.pathname.startsWith('/api/books/')) {
      const pathParts = url.pathname.split('/');
      const rawPath = url.searchParams.get('path');
      return {
        bookId: pathParts[3],
        path: rawPath ? decodeURIComponent(rawPath) : undefined
      };
    }
    return { url: src };
  } catch (e) {
    return { url: src };
  }
};

// OCR 请求期间锁定按钮，避免重复提交，并同步按钮文案。
const setOCRButtonPending = (btn: HTMLButtonElement, pending: boolean) => {
  btn.disabled = pending;
  btn.dataset.pending = String(pending);
  const label = btn.querySelector('span');
  if (label) label.textContent = pending ? '识别中' : '识别文字';
};

const insertOCRSentences = (img: HTMLImageElement, sentences: string[]) => {
  // OCR 按钮和图片已经被包在 wrapper 中，识别结果要插到这个 wrapper 后面。
  const wrapper = img.parentElement;
  if (!wrapper) return;

  // 如果这张图已经插入过 OCR 结果，就复用并更新，避免重复点击后堆叠多个结果块。
  const next = wrapper.nextElementSibling as HTMLElement | null;
  const result = next?.dataset.ocrResult === 'true' ? next : document.createElement('p');
  // 生成稳定的 s-* ID，让 OCR 句子能被现有朗读、点击选句和高亮逻辑识别。
  const baseId = wrapper.dataset.ocrBaseId || `s-ocr-${crypto.randomUUID()}`;
  wrapper.dataset.ocrBaseId = baseId;
  result.className = styles.ocr_result;
  result.dataset.ocrResult = 'true';
  result.textContent = '';

  // 每个 OCR 分句都作为普通 sentence span 插入，朗读顺序由它在 DOM 中的位置决定。
  sentences.forEach((sentence, index) => {
    const span = document.createElement('span');
    span.className = 'sentence';
    span.id = `${baseId}-${index + 1}`;
    span.textContent = sentence;
    result.appendChild(span);
  });

  // 新结果块只在首次识别时插入；后续识别会直接更新上面的 result。
  if (result !== next) {
    wrapper.parentNode?.insertBefore(result, wrapper.nextSibling);
  }
};

const handleOCR = async (
  img: HTMLImageElement,
  btn: HTMLButtonElement
) => {
  const src = img.getAttribute('src');
  if (!src) return;

  console.log('[OCR] 正在启动识别程序...');
  // src 可能来自 EPUB 资源代理，也可能是普通网页图片。
  const payload = parseImageSource(src);

  setOCRButtonPending(btn, true);
  try {
    const data = await request<{ text: string; sentences?: string[] }>('/api/reader/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!btn.isConnected) return;

    const sentences = data.sentences?.length ? data.sentences : [data.text];
    insertOCRSentences(img, sentences);
  } catch (err) {
    console.error('[OCR] 识别过程出错:', err);
  } finally {
    // 内容切换时按钮可能已经被卸载，避免操作失效 DOM。
    if (btn.isConnected) {
      setOCRButtonPending(btn, false);
    }
  }
};

const createOCRButton = (img: HTMLImageElement) => {
  const btn = document.createElement('button');
  btn.className = styles.ocr_button;
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', '提取图片文字');

  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 3H4a1 1 0 0 0-1 1v3"></path>
      <path d="M17 3h3a1 1 0 0 1 1 1v3"></path>
      <path d="M3 17v3a1 1 0 0 0 1 1h3"></path>
      <path d="M21 17v3a1 1 0 0 1-1 1h-3"></path>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
    <span>识别文字</span>
  `;

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleOCR(img, btn);
  };

  return btn;
};

// 给图片记录加载状态，供样式层区分加载中与已完成的图片。
const markImageLoadState = (img: HTMLImageElement) => {
  if (img.dataset.loaded === 'true') return;

  if (img.complete) {
    img.dataset.loaded = 'true';
    return;
  }

  const markLoaded = () => {
    img.dataset.loaded = 'true';
  };

  img.addEventListener('load', markLoaded, { once: true });
  img.addEventListener('error', markLoaded, { once: true });
};

const isLargeReadableImage = (img: HTMLImageElement) =>
  img.naturalWidth >= OCR_IMAGE_MIN_WIDTH && img.naturalHeight >= OCR_IMAGE_MIN_HEIGHT;

// 未完成加载的图片暂不装饰，等 load/error 后重新判断尺寸。
const decorateAfterLoad = (img: HTMLImageElement) => {
  if (img.dataset.ocrPending === 'true') return;
  img.dataset.ocrPending = 'true';

  const retryDecorate = () => {
    delete img.dataset.ocrPending;
    decorateImage(img);
  };

  img.addEventListener('load', retryDecorate, { once: true });
  img.addEventListener('error', () => {
    delete img.dataset.ocrPending;
  }, { once: true });
};

const decorateImage = (img: HTMLImageElement) => {
  markImageLoadState(img);

  // 已经包过 OCR 容器的图片不重复处理。
  if (img.parentElement?.classList.contains(styles.image_wrapper)) return;

  if (!img.complete) {
    img.dataset.readerImage = 'inline';
    decorateAfterLoad(img);
    return;
  }

  // 小图多半是图标、分隔符或头像，不展示 OCR 操作入口。
  if (!isLargeReadableImage(img)) {
    img.dataset.readerImage = 'inline';
    return;
  }

  img.dataset.readerImage = 'block';

  const wrapper = document.createElement('div');
  wrapper.className = styles.image_wrapper;
  const btn = createOCRButton(img);

  if (img.parentNode) {
    img.parentNode.replaceChild(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(btn);
  }
};

export function useReaderImages(
  contentRef: RefObject<HTMLDivElement | null>,
  options: { articleId?: string; bookId?: string; canUseOcr?: boolean }
) {
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    if (options.canUseOcr === false) return;

    const decorateImages = () => {
      const images = container.querySelectorAll('img');
      images.forEach(decorateImage);
    };

    decorateImages();

    // 阅读内容可能由章节切换、懒加载或 HTML 清洗后动态插入，监听新增节点后补装饰。
    const observer = new MutationObserver((mutations) => {
      const needsRescan = mutations.some((mutation) => mutation.type === 'childList');
      if (needsRescan) {
        decorateImages();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [contentRef, options.articleId, options.bookId, options.canUseOcr]);
}
