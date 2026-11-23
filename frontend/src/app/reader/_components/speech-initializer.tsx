"use client";

import { useEffect, useState } from "react";
import { showConfirm } from "@/app/global-modals";
import { showToast } from "@/app/global-toasts";
import type { SpeechLanguage } from "../_store/store";

const modelUrl = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx";
let downloadProgress: number | null = -1;
let downloadPromise: Promise<boolean> | undefined;
let progressCallback: ((progress: number | null) => void) | undefined;

function updateProgress(progress: number | null) {
  if (downloadProgress === progress) return;
  downloadProgress = progress;
  progressCallback?.(progress);
}

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

  updateProgress(null);
  const response = await fetch(modelUrl);
  if (response.status !== 200 || !response.body) throw new Error("模型文件下载失败");

  const total = Number(response.headers.get("content-length"));
  let received = 0;
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (total > 0) updateProgress(Math.min(99, Math.floor(received / total * 100)));
      controller.enqueue(chunk);
    },
  }));
  await cache.put(modelUrl, new Response(body, { headers: response.headers }));
  updateProgress(100);
  window.setTimeout(() => {
    if (downloadProgress === 100) updateProgress(-1);
  }, 800);
  // 这次请求只下载，下一次主动选择时才允许切换。
  return false;
}

export function requestSpeechLanguage(language: SpeechLanguage): Promise<boolean> {
  if (language !== "en-US") return Promise.resolve(true);

  downloadPromise ??= downloadModel().catch(() => {
    updateProgress(-1);
    showToast({ message: "语音模型下载失败，请再次选择英文重试。", type: "error" });
    return false;
  }).finally(() => {
    downloadPromise = undefined;
  });
  return downloadPromise;
}

export function SpeechInitializer() {
  const [progress, setProgress] = useState(downloadProgress);

  useEffect(() => {
    progressCallback = setProgress;
    setProgress(downloadProgress);
    return () => {
      if (progressCallback === setProgress) progressCallback = undefined;
    };
  }, []);

  if (progress !== null && progress < 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-30 flex items-center gap-2 rounded-xl bg-base-300 py-1 pr-1 pl-3 text-xs shadow-sm">
      <span>{progress === 100 ? "语音模型下载完成" : "语音模型下载中..."}</span>
      {progress === null ? (
        <span className="loading loading-spinner text-primary" role="status" aria-label="语音模型下载中" />
      ) : <div
        className="grid size-10 shrink-0 rounded-lg p-0.75 text-primary"
        style={{ backgroundImage: `conic-gradient(var(--color-primary) ${progress}%, var(--color-base-300) 0)` }}
        role="progressbar"
        aria-label="语音模型下载进度"
        aria-valuenow={progress}
      >
        <span className="grid place-items-center rounded-md bg-base-300">{progress}%</span>
      </div>}
    </div>
  );
}
