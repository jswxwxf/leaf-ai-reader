"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * 确认框配置接口
 */
interface ConfirmConfig {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve?: (value: void | PromiseLike<void>) => void;
  reject?: (reason?: any) => void;
}

/**
 * 提示框配置接口
 */
interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  buttonText: string;
  selectable?: boolean;
  resolve?: (value: void | PromiseLike<void>) => void;
}

const DEFAULT_CONFIRM: ConfirmConfig = {
  visible: false,
  title: "确认操作",
  message: "您确定要执行此操作吗？",
  confirmText: "确定",
  cancelText: "取消",
};

const DEFAULT_ALERT: AlertConfig = {
  visible: false,
  title: "提示",
  message: "",
  buttonText: "我知道了",
  selectable: false,
};

// 使用队列存储在组件挂载前被调用的配置
let pendingConfirm: ConfirmConfig | null = null;
let pendingAlert: AlertConfig | null = null;

let setConfirmConfig: (config: ConfirmConfig) => void = (config) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn("[GlobalModals] showConfirm called before mount. Queueing action.");
  }
  pendingConfirm = config;
};

let setAlertConfig: (config: AlertConfig) => void = (config) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn("[GlobalModals] showAlert called before mount. Queueing action.");
  }
  pendingAlert = config;
};

/**
 * 显示全局确认框
 * 返回 Promise，点击“确定”时 resolve，点击“取消”或背景时 reject
 */
export const showConfirm = (options: Partial<Omit<ConfirmConfig, 'visible' | 'resolve' | 'reject'>>) => {
  return new Promise<void>((resolve, reject) => {
    setConfirmConfig({
      ...DEFAULT_CONFIRM,
      ...options,
      visible: true,
      resolve,
      reject,
    });
  });
};

/**
 * 显示全局提示框
 * 返回 Promise，点击按钮或背景时 resolve
 */
export const showAlert = (options: Partial<Omit<AlertConfig, 'visible' | 'resolve'>>) => {
  return new Promise<void>((resolve) => {
    setAlertConfig({
      ...DEFAULT_ALERT,
      ...options,
      visible: true,
      resolve,
    });
  });
};

/**
 * 全局模态框组件
 * 
 * 采用单例状态模式，提供 showConfirm 和 showAlert 的异步交互支持
 */
export function GlobalModals() {
  const [confirmConfig, _setConfirmConfig] = useState<ConfirmConfig>(DEFAULT_CONFIRM);
  const [alertConfig, _setAlertConfig] = useState<AlertConfig>(DEFAULT_ALERT);

  const confirmRef = useRef<HTMLDialogElement>(null);
  const alertRef = useRef<HTMLDialogElement>(null);

  // 监听 Confirm 显隐并操作原生 DOM
  useEffect(() => {
    if (confirmConfig.visible) {
      confirmRef.current?.showModal();
    } else {
      confirmRef.current?.close();
    }
  }, [confirmConfig.visible]);

  // 监听 Alert 显隐并操作原生 DOM
  useEffect(() => {
    if (alertConfig.visible) {
      alertRef.current?.showModal();
    } else {
      alertRef.current?.close();
    }
  }, [alertConfig.visible]);

  useEffect(() => {
    setConfirmConfig = _setConfirmConfig;
    setAlertConfig = _setAlertConfig;
    
    // 如果在水合(Hydration)前有被拦截的操作，立刻执行它们并清空队列
    if (pendingConfirm) {
      _setConfirmConfig(pendingConfirm);
      pendingConfirm = null;
    }
    if (pendingAlert) {
      _setAlertConfig(pendingAlert);
      pendingAlert = null;
    }
  }, [_setConfirmConfig, _setAlertConfig]);

  // Confirm 处理函数
  const handleConfirmAction = () => {
    _setConfirmConfig({ ...DEFAULT_CONFIRM, visible: false });
    confirmConfig.resolve?.();
  };

  const handleConfirmCancel = () => {
    _setConfirmConfig({ ...DEFAULT_CONFIRM, visible: false });
    confirmConfig.reject?.(new Error("User cancelled"));
  };

  // Alert 处理函数
  const handleAlertClose = () => {
    _setAlertConfig({ ...DEFAULT_ALERT, visible: false });
    alertConfig.resolve?.();
  };

  return (
    <>
      {/* 确认模态框 */}
      <dialog
        ref={confirmRef}
        className="modal items-start pt-10"
        onClose={handleConfirmCancel}
      >
        <div className="modal-box max-w-md rounded-md shadow-2xl p-6 border border-neutral/5">
          <h3 className="text-lg font-bold text-neutral">{confirmConfig.title}</h3>
          <p className="py-4 text-neutral/70 leading-relaxed whitespace-pre-wrap">
            {confirmConfig.message}
          </p>

          <div className="modal-action gap-3">
            <button
              className="btn btn-ghost hover:bg-neutral/5 rounded px-6 min-h-0 h-10 font-normal"
              onClick={handleConfirmCancel}
            >
              {confirmConfig.cancelText}
            </button>
            <button
              className="btn btn-error text-white rounded px-6 min-h-0 h-10 shadow-lg shadow-error/20 border-none px-8"
              onClick={handleConfirmAction}
            >
              {confirmConfig.confirmText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleConfirmCancel}>close</button>
        </form>
      </dialog>

      {/* 提示模态框 */}
      <dialog
        ref={alertRef}
        className="modal items-start pt-10"
        onClose={handleAlertClose}
      >
        <div className="modal-box max-w-md rounded-md shadow-2xl p-6 border border-neutral/5 flex flex-col max-h-[85vh]">
          <h3 className="text-lg font-bold text-neutral flex-none">{alertConfig.title}</h3>
          
          <div className="flex-1 overflow-y-auto my-4 pr-2">
            <p 
              className={`text-neutral/70 leading-relaxed whitespace-pre-wrap text-sm ${alertConfig.selectable ? 'select-all cursor-pointer' : ''}`}
              onClick={alertConfig.selectable ? (e) => window.getSelection()?.selectAllChildren(e.currentTarget) : undefined}
            >
              {alertConfig.message}
            </p>
          </div>

          <div className="modal-action flex-none mt-0">
            <button
              className="btn btn-primary text-white rounded w-full min-h-0 h-11 shadow-lg shadow-primary/20 border-none"
              onClick={handleAlertClose}
            >
              {alertConfig.buttonText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleAlertClose}>close</button>
        </form>
      </dialog>
    </>
  );
}
