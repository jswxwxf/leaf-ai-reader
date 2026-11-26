import type { KokoroTTS } from "kokoro-js";
import { splitSpeechText } from "../_utils/text";

/** 主线程发来的请求：只加载模型，或按指定音色和速度合成一句。 */
export type KokoroRequest =
  | { type: "load" }
  | { type: "generate"; text: string; voice: "af_sarah"; speed: number };

/** 主线程构建 Web Audio 缓冲区所需的采样数据和采样率。 */
export interface SynthesizedAudio {
  audio: Float32Array;
  sampling_rate: number;
}

/** 加载成功时仅确认完成，合成成功时附带音频，失败时返回错误信息。 */
export type KokoroResponse =
  | { ok: true; audio?: SynthesizedAudio }
  | { ok: false; error: string; restartWorker: boolean };

let modelPromise: Promise<KokoroTTS> | undefined;

function loadModel() {
  // 首次收到请求时加载模型，并发请求和后续合成都复用同一个加载任务。
  modelPromise ??= import("kokoro-js")
    .then(({ KokoroTTS }) => KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      device: "webgpu",
      dtype: "fp32",
    }))
    .catch((error) => {
      // 加载失败后清空记录，让下次请求可以重试。
      modelPromise = undefined;
      throw error;
    });
  return modelPromise;
}

/** 分段合成并拼接采样，让主线程仍收到一条完整的句子音频。 */
async function synthesizeSpeech(
  model: KokoroTTS,
  data: Extract<KokoroRequest, { type: "generate" }>,
  isReplied: () => boolean,
): Promise<SynthesizedAudio | undefined> {
  const options = { voice: data.voice, speed: data.speed };
  const [firstSegment = data.text, ...remainingSegments] = splitSpeechText(data.text)
    .filter((segment) => segment.trim());
    
  // 为了防止开头吞音，因此每段开头都加逗号。
  const generateSegment = (segment: string) => model.generate(`, ${segment}`, options);
  const first = await generateSegment(firstSegment);
  if (isReplied()) return;

  if (!remainingSegments.length) {
    return { audio: first.audio, sampling_rate: first.sampling_rate };
  }

  // 长句逐段合成，减小单次推理负载，再按原顺序拼接成一条句子音频。
  const chunks = [first.audio];
  let totalLength = first.audio.length;
  for (const segment of remainingSegments) {
    const { audio } = await generateSegment(segment);
    if (isReplied()) return;
    chunks.push(audio);
    totalLength += audio.length;
  }

  const audio = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }
  return { audio, sampling_rate: first.sampling_rate };
}

self.addEventListener("message", async ({ data, ports }: MessageEvent<KokoroRequest>) => {
  // 每次请求都带有专用的回复端口，主线程用另一端接收对应的结果。
  const [replySender] = ports;
  let replied = false;

  const reply = (response: KokoroResponse) => {
    if (replied) return;
    replySender.postMessage(response);
    replied = true;
    self.removeEventListener("unhandledrejection", handleRejection);
    replySender.close();
  };

  const replyError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // GPU 缓冲区映射失败或设备丢失后，需要重建 WebGPU 后端。
    const restartWorker = /map\s*async|\bdevice\b.{0,24}\blost\b|\blost\b.{0,24}\bdevice\b/i.test(message);
    reply({ ok: false, error: message, restartWorker });
  };

  // 将 Worker 内未捕获的异步错误回传给当前请求。
  const handleRejection = (event: PromiseRejectionEvent) => replyError(event.reason);
  self.addEventListener("unhandledrejection", handleRejection);

  try {
    const model = await loadModel();
    if (data.type === "load") {
      reply({ ok: true });
      return;
    }

    const audio = await synthesizeSpeech(model, data, () => replied);
    if (audio) reply({ ok: true, audio });
  } catch (error) {
    replyError(error);
  }
});
