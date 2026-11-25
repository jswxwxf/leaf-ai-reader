"use client";

import { useEffect, useState } from "react";
import { showConfirm } from "@/app/global-modals";
import { showToast } from "@/app/global-toasts";
import { subscribeReady } from "../_engines/kokoro-engine";
import { createObservableValue } from "../_utils/observable";
import type { SpeechLanguage } from "../_store/store";

const modelUrl = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx";
const downloadProgress = createObservableValue<number | null>(-1);
let downloadPromise: Promise<boolean> | undefined;

async function downloadModel(): Promise<boolean> {
  const cache = await caches.open("transformers-cache");
  if (await cache.match(modelUrl)) return true;

  try {
    await showConfirm({
      title: "下载语音模型",
      message: "首次使用该语音需要下载约 326 MB 的语音模型。下载完成后，请再次选择。",
      confirmText: "下载",
    });
  } catch {
    return false;
  }

  downloadProgress.set(null);
  const response = await fetch(modelUrl);
  if (response.status !== 200 || !response.body) throw new Error("模型文件下载失败");

  const total = Number(response.headers.get("content-length"));
  let received = 0;
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (total > 0) downloadProgress.set(Math.min(99, Math.floor(received / total * 100)));
      controller.enqueue(chunk);
    },
  }));
  await cache.put(modelUrl, new Response(body, { headers: response.headers }));
  downloadProgress.set(100);
  window.setTimeout(() => {
    if (downloadProgress.get() === 100) downloadProgress.set(-1);
  }, 800);
  // 这次请求只下载，下一次主动选择时才允许切换。
  return false;
}

export function requestSpeechLanguage(language: SpeechLanguage): Promise<boolean> {
  if (language !== "en-US") return Promise.resolve(true);

  downloadPromise ??= downloadModel().catch(() => {
    downloadProgress.set(-1);
    showToast({ message: "语音模型下载失败，请再次选择英文重试。", type: "error" });
    return false;
  }).finally(() => {
    downloadPromise = undefined;
  });
  return downloadPromise;
}

export function SpeechInitializer() {
  const [progress, setProgress] = useState(downloadProgress.get);
  const [ready, setReady] = useState<boolean>();

  useEffect(() => downloadProgress.subscribe(setProgress), []);
  useEffect(() => subscribeReady(setReady), []);

  const isDownloadVisible = progress === null || progress >= 0;
  if (!isDownloadVisible && ready !== false) return null;

  const message = !isDownloadVisible
    ? "正在准备英文语音…"
    : progress === 100 ? "语音模型下载完成" : "语音模型下载中...";
  const progressValue = isDownloadVisible ? progress : null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-30 flex items-center gap-2 rounded-xl bg-base-300 py-1 pr-1 pl-3 text-xs shadow-sm">
      <span>{message}</span>
      <div
        className={`grid size-10 shrink-0 rounded-lg p-0.75 text-primary ${progressValue === null ? "" : "bg-base-content/10"}`}
        style={progressValue === null ? undefined : {
          backgroundImage: `conic-gradient(var(--color-primary) ${progressValue}%, transparent 0)`,
        }}
        role={progressValue === null ? "status" : "progressbar"}
        aria-label={progressValue === null ? message : "语音模型下载进度"}
        aria-valuenow={progressValue ?? undefined}
      >
        <span className="grid place-items-center rounded-md bg-base-300">
          {progressValue === null
            ? <span className="loading loading-spinner size-5" aria-hidden="true" />
            : `${progressValue}%`}
        </span>
      </div>
    </div>
  );
}
