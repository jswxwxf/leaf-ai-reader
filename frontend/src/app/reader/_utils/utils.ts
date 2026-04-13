const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 80;

/**
 * 检查元素是否在阅读器的安全视口内（避开 Header 和 Footer）
 * 如果不在视口内或被遮挡，则执行平滑滚动将其置于中心
 */
export function scrollIntoViewIfNeeded(el: HTMLElement) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const BUFFER = 60; // 缓冲区，确保句子不贴边

  // 判断是否超出安全区域
  const isOutOfView =
    rect.top < (HEADER_HEIGHT + BUFFER) ||
    rect.bottom > (window.innerHeight - FOOTER_HEIGHT - BUFFER);

  if (isOutOfView) {
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}

/**
 * 浏览器环境检测
 */
export const isSafari =
  typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
