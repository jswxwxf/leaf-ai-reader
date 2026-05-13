import { useEffect, type RefObject } from 'react';
import { request } from '../../../lib/request';
import { showAlert } from '../../global-modals';
import styles from '../_components/content.module.css';

const OCR_IMAGE_MIN_WIDTH = 180;
const OCR_IMAGE_MIN_HEIGHT = 100;

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

const setOCRButtonPending = (btn: HTMLButtonElement, pending: boolean) => {
  btn.disabled = pending;
  btn.dataset.pending = String(pending);
  const label = btn.querySelector('span');
  if (label) label.textContent = pending ? '识别中' : '识别文字';
};

const handleOCR = async (
  img: HTMLImageElement,
  btn: HTMLButtonElement
) => {
  const src = img.getAttribute('src');
  if (!src) return;

  console.log('[OCR] 正在启动识别程序...');
  const payload = parseImageSource(src);

  setOCRButtonPending(btn, true);
  try {
    const data = await request<{ text: string }>('/api/reader/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!btn.isConnected) return;

    showAlert({
      title: '图片识别结果',
      message: data.text,
      buttonText: '关闭',
      selectable: true
    });
  } catch (err) {
    console.error('[OCR] 识别过程出错:', err);
  } finally {
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

  if (img.parentElement?.classList.contains(styles.image_wrapper)) return;

  if (!img.complete) {
    img.dataset.readerImage = 'inline';
    decorateAfterLoad(img);
    return;
  }

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
