"use client";

import React, { useState, useEffect } from "react";

/**
 * 极简全屏加载组件
 * 
 * 使用全局单例模式，无需 Provider 即可控制显示
 * 导出 showFullScreenLoading 和 hideFullScreenLoading 方法
 */

let setVisibleGlobally: (visible: boolean) => void;

/**
 * 显示全屏加载
 */
export const showFullScreenLoading = () => {
    if (setVisibleGlobally) setVisibleGlobally(true);
};

/**
 * 隐藏全屏加载
 */
export const hideFullScreenLoading = () => {
    if (setVisibleGlobally) setVisibleGlobally(false);
};

export function FullScreenLoading() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // 组件安装时将 setVisible 挂载到全局变量
        setVisibleGlobally = setVisible;
        return () => {
            // 组件卸载时清理（虽然加载组件通常不会卸载）
            setVisibleGlobally = () => {};
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-white/10 backdrop-blur-[2px]">
            {/* 使用 DaisyUI 的 loading-ring，满足旋转需求且线条细腻 */}
            <span className="loading loading-ring w-16 h-16 text-primary"></span>
        </div>
    );
}
