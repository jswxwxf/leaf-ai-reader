import { useEffect, type RefObject } from 'react';
import { request } from '../../../lib/request';
import { showAlert } from '../../global-modals';
import { showLoading, hideLoading } from '../../full-screen-loading';
import styles from '../_components/content.module.css';

/**
 * --- 工具函数 1: 解析图片来源参数 ---
 */
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

/**
 * --- 工具函数 2: 处理 OCR 识别请求 ---
 */
const handleOCR = async (img: HTMLImageElement) => {
  const src = img.getAttribute('src');
  if (!src) return;

  console.log('[OCR] 正在启动识别程序...');
  const payload = parseImageSource(src);

  showLoading();
  try {
    const data = await request<{ text: string }>('/api/reader/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    showAlert({
      title: '图片识别结果',
      message: data.text,
      buttonText: '关闭',
      selectable: true
    });
  } catch (err) {
    console.error('[OCR] 识别过程出错:', err);
  } finally {
    hideLoading();
  }
};

/**
 * --- 工具函数 3: 创建 OCR 悬浮按钮元素 ---
 */
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
    handleOCR(img);
  };
  
  return btn;
};

/**
 * --- 工具函数 4: 为单个图片元素执行 DOM 装饰逻辑 ---
 */
const decorateImage = (img: HTMLImageElement) => {
  if (img.parentElement?.classList.contains(styles.image_wrapper)) return;

  const wrapper = document.createElement('div');
  wrapper.className = styles.image_wrapper;
  const btn = createOCRButton(img);

  if (img.parentNode) {
    img.parentNode.replaceChild(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(btn);
  }
};

/**
 * 自动识别图片并注入 OCR 悬浮按钮的 Hook
 * 采用 MutationObserver 模式，实现对 DOM 变化的实时监听，防止按钮丢失。
 */
export function useOCR(contentRef: RefObject<HTMLDivElement | null>, options: { articleId?: string; bookId?: string }) {
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // 1. 初次执行
    const images = container.querySelectorAll('img');
    images.forEach(decorateImage);

    // 2. 建立观察者，监听子树变动（如 dangerouslySetInnerHTML 引起的重排）
    const observer = new MutationObserver((mutations) => {
      let needsRescan = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          needsRescan = true;
          break;
        }
      }
      if (needsRescan) {
        const currentImages = container.querySelectorAll('img');
        currentImages.forEach(decorateImage);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [options.articleId, options.bookId]);
}
