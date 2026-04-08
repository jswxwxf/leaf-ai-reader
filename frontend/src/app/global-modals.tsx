"use client";

import React, { useState, useEffect } from "react";

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
};

let setConfirmConfig: (config: ConfirmConfig) => void;
let setAlertConfig: (config: AlertConfig) => void;

/**
 * 显示全局确认框
 * 返回 Promise，点击“确定”时 resolve，点击“取消”或背景时 reject
 */
export const showConfirm = (options: Partial<Omit<ConfirmConfig, 'visible' | 'resolve' | 'reject'>>) => {
  return new Promise<void>((resolve, reject) => {
    setConfirmConfig?.({
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
    setAlertConfig?.({
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

  useEffect(() => {
    setConfirmConfig = _setConfirmConfig;
    setAlertConfig = _setAlertConfig;
    return () => {
      setConfirmConfig = () => { };
      setAlertConfig = () => { };
    };
  }, []);

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
        className={`modal z-50 items-start pt-10 bg-black/20 backdrop-blur-[1px] ${confirmConfig.visible ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-md rounded-2xl shadow-2xl p-6 border border-neutral/5">
          <h3 className="text-lg font-bold text-neutral">{confirmConfig.title}</h3>
          <p className="py-4 text-neutral/70 leading-relaxed whitespace-pre-wrap">
            {confirmConfig.message}
          </p>

          <div className="modal-action gap-3">
            <button
              className="btn btn-ghost hover:bg-neutral/5 rounded-xl px-6 min-h-0 h-10 font-normal"
              onClick={handleConfirmCancel}
            >
              {confirmConfig.cancelText}
            </button>
            <button
              className="btn btn-error text-white rounded-xl px-6 min-h-0 h-10 shadow-lg shadow-error/20 border-none px-8"
              onClick={handleConfirmAction}
            >
              {confirmConfig.confirmText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={handleConfirmCancel}>
          <button>close</button>
        </form>
      </dialog>

      {/* 提示模态框 */}
      <dialog
        className={`modal z-50 items-start pt-10 bg-black/20 backdrop-blur-[1px] ${alertConfig.visible ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-md rounded-2xl shadow-2xl p-6 border border-neutral/5">
          <h3 className="text-lg font-bold text-neutral">{alertConfig.title}</h3>
          <p className="py-4 text-neutral/70 leading-relaxed whitespace-pre-wrap">
            {alertConfig.message}
          </p>

          <div className="modal-action">
            <button
              className="btn btn-primary text-white rounded-xl w-full min-h-0 h-11 shadow-lg shadow-primary/20 border-none"
              onClick={handleAlertClose}
            >
              {alertConfig.buttonText}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onClick={handleAlertClose}>
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
