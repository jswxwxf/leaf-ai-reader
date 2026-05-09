"use client";

import { useState, useEffect } from "react";

/**
 * 极简全屏加载组件
 * 
 * 使用全局单例模式，无需 Provider 即可控制显示
 * 导出 showLoading 和 hideLoading 方法
 */

let setGlobalState: (visible: boolean, showIndicator: boolean) => void = () => {
    if (process.env.NODE_ENV === 'development') {
        console.warn("[FullScreenLoading] State called before component was mounted.");
    }
};

let autoHideTimer: number | null = null;

interface ShowLoadingOptions {
    autoHideAfterMs?: number;
}

function clearAutoHideTimer() {
    if (!autoHideTimer) return;
    window.clearTimeout(autoHideTimer);
    autoHideTimer = null;
}

/**
 * 显示全屏加载
 * @param showIndicator 是否显示旋转图标，默认为 true
 * @param options.autoHideAfterMs 指定毫秒数后自动隐藏
 */
export const showLoading = (showIndicator = true, options: ShowLoadingOptions = {}) => {
    clearAutoHideTimer();
    setGlobalState(true, showIndicator);

    if (options.autoHideAfterMs && options.autoHideAfterMs > 0) {
        autoHideTimer = window.setTimeout(() => {
            setGlobalState(false, true);
            autoHideTimer = null;
        }, options.autoHideAfterMs);
    }
};

/**
 * 隐藏全屏加载
 */
export const hideLoading = () => {
    clearAutoHideTimer();
    setGlobalState(false, true);
};

export function FullScreenLoading() {
    const [visible, setVisible] = useState(false);
    const [showIndicator, setShowIndicator] = useState(true);

    useEffect(() => {
        setGlobalState = (v: boolean, i: boolean) => {
            setVisible(v);
            setShowIndicator(i);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-white/10 backdrop-blur-[1px]">
            {/* 使用 DaisyUI 的 loading-ring，展示可选的加载图标 */}
            {showIndicator && (
                <span className="loading loading-ring w-16 h-16 text-primary"></span>
            )}
        </div>
    );
}
