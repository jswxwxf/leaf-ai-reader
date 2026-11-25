import { createObservableValue } from "../_utils/observable";
import type { SpeakOptions, SpeechEngine } from "./engine";

import type { KokoroRequest, KokoroResponse, SynthesizedAudio } from "./kokoro.worker";

const voice = "af_sarah";
const speed = 1.4;
const audioCache = new Map<string, SynthesizedAudio>();
const maxCachedAudio = 9;

let worker: Worker | undefined;
let modelPromise: Promise<SynthesizedAudio | undefined> | undefined;
// undefined 表示空闲，false 表示正在加载，true 表示模型已就绪。
const ready = createObservableValue<boolean | undefined>(undefined);
export const subscribeReady = ready.subscribe;
let synthesisTask: { key: string; promise: Promise<SynthesizedAudio> } | undefined;
let pendingSession: number | undefined;
let audioContext: AudioContext | undefined;
let activeSource: AudioBufferSourceNode | undefined;
// 每次停止或开始新朗读都会更新编号，异步回调用它判断自己是否仍有效。
let session = 0;

function requestWorker(request: KokoroRequest) {
  const synthesisWorker = worker ??= new Worker(new URL("./kokoro.worker.ts", import.meta.url), {
    type: "module",
  });
  const { port1: replyReceiver, port2: replySender } = new MessageChannel();

  return new Promise<SynthesizedAudio | undefined>((resolve, reject) => {
    const cleanup = () => {
      replyReceiver.close();
      synthesisWorker.removeEventListener("error", handleError);
    };
    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || "Kokoro Worker 加载失败"));
    };
    synthesisWorker.addEventListener("error", handleError);

    replyReceiver.onmessage = ({ data }: MessageEvent<KokoroResponse>) => {
      cleanup();
      if (data.ok) {
        resolve(data.audio);
        return;
      }
      reject(new Error(data.error));
    };

    try {
      synthesisWorker.postMessage(request, [replySender]);
    } catch (error) {
      cleanup();
      replySender.close();
      reject(error);
    }
  });
}

function loadModel() {
  if (modelPromise) return modelPromise;

  // 首次朗读才通知 Worker 加载模型，后续请求复用该初始化任务。
  modelPromise = requestWorker({ type: "load" }).then((result) => {
    ready.set(true);
    return result;
  }).catch((error) => {
    modelPromise = undefined;
    ready.set(undefined);
    throw error;
  });
  ready.set(false);
  return modelPromise;
}

async function synthesize(text: string) {
  const audio = await requestWorker({ type: "generate", text, voice, speed });
  if (!audio) throw new Error("Kokoro Worker 未返回音频");
  return audio;
}

function stop() {
  session += 1;
  const source = activeSource;
  if (!source) return;

  activeSource = undefined;
  // 手动停止也可能触发 ended，先移除回调，避免把停止当成自然播完。
  source.onended = null;
  source.stop();
  source.disconnect();
}

function getCacheKey(text: string) {
  return JSON.stringify([text, voice, speed]);
}

async function generateAudio(text: string, cacheKey: string) {
  // 只合成音频。记录本次推理，供下一次朗读等待，并在推理结束后释放。
  try {
    synthesisTask = { key: cacheKey, promise: synthesize(text) };

    const speech = await synthesisTask.promise;
    audioCache.set(cacheKey, speech);
    // 先淘汰最早存入的音频，滑动窗口策略后续接入。
    const oldest = audioCache.keys().next();
    if (audioCache.size > maxCachedAudio && !oldest.done) audioCache.delete(oldest.value);
    return speech;
  } finally {
    synthesisTask = undefined;
  }
}

/** 尝试在模型空闲时预合成一句，结果只写入缓存。 */
async function prepare(text: string): Promise<boolean> {
  const cacheKey = getCacheKey(text);
  if (audioCache.has(cacheKey)) return true;

  try {
    await loadModel();
    // 等待模型期间，其他请求可能已经把这句写入缓存。
    if (audioCache.has(cacheKey)) return true;

    // 同一缓存键共用一次合成，完成后由原任务写入缓存。
    if (synthesisTask?.key === cacheKey) {
      await synthesisTask.promise;
      return true;
    }

    // 点播可能还在等模型、尚未开始合成。模型忙或有点播在等时，跳过预合成。
    if (synthesisTask || pendingSession === session) return false;

    await generateAudio(text, cacheKey);
    return true;
  } catch {
    // 预合成失败后，点播仍可正常重试。
    return false;
  }
}

function playAudio(context: AudioContext, speech: SynthesizedAudio, onEnd: () => void) {
  // 将 Kokoro 返回的单声道采样写入 Web Audio 缓冲区，再创建播放节点。
  const buffer = context.createBuffer(1, speech.audio.length, speech.sampling_rate);
  buffer.getChannelData(0).set(speech.audio);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    activeSource = undefined;
    source.disconnect();
    onEnd();
  };
  source.start();
  activeSource = source;
}

async function speak({ text, onEnd, onError }: SpeakOptions) {
  stop();
  const currentSession = session;
  pendingSession = currentSession;

  try {
    const context = audioContext ??= new AudioContext();
    // 在点击播放的同一次调用中发起 resume，避免等模型加载后才请求播放权限。
    await Promise.all([
      loadModel(),
      context.state === "running" ? undefined : context.resume(),
    ]);

    const cacheKey = getCacheKey(text);

    // 缓存未命中时串行合成。等待结束后，可能已有缓存、新任务或会话变化，需要重新检查。
    while (!audioCache.has(cacheKey) && synthesisTask && currentSession === session) {
      // 旧任务失败时，当前请求仍可尝试合成。
      await synthesisTask.promise.catch(() => undefined);
    }
    // 等待期间如果用户停止或换句，旧请求直接退出。
    if (currentSession !== session) return;

    const speech = audioCache.get(cacheKey) ?? await generateAudio(text, cacheKey);
    // 停止或换句后，合成结果仍可留在缓存里，旧会话跳过播放。
    if (currentSession !== session) return;

    playAudio(context, speech, () => {
      if (currentSession === session) onEnd();
    });
  } catch (error) {
    if (currentSession === session) onError(error);
  } finally {
    if (pendingSession === currentSession) pendingSession = undefined;
  }
}

export const kokoroEngine = {
  getText(sentence: HTMLElement) {
    return sentence.textContent?.trim() ?? "";
  },
  speak,
  stop,
  prepare,
} satisfies SpeechEngine;
