import { useCallback, useEffect, useRef } from "react";

export type SoundEffectName = "success" | "notification" | "error";

interface UseSoundEffectOptions {
  /** 要播放的内置提示音；音高、节奏和波形统一由本 Hook 管理。 */
  sound?: SoundEffectName;
  /** 总音量，范围为 0 到 1。 */
  volume?: number;
}

interface Tone {
  frequency: number;
  duration: number;
  delay?: number;
  volume: number;
  waveform: OscillatorType;
}

// 新增提示音时只需在这里定义音符序列，调用方仍只需要传 sound 名称。
const SOUND_EFFECTS: Record<SoundEffectName, readonly Tone[]> = {
  success: [
    { frequency: 659.25, duration: 0.1, volume: 0.12, waveform: "sine" },
    { frequency: 783.99, duration: 0.16, delay: 0.04, volume: 0.12, waveform: "sine" },
  ],
  notification: [
    { frequency: 783.99, duration: 0.13, volume: 0.1, waveform: "sine" },
  ],
  error: [
    { frequency: 392, duration: 0.12, volume: 0.1, waveform: "triangle" },
    { frequency: 293.66, duration: 0.16, delay: 0.05, volume: 0.1, waveform: "triangle" },
  ],
};

/**
 * 播放浏览器合成的短提示音，无需额外的音频文件。
 *
 * 调用方在用户手势（例如按钮点击）时调用 prepare，再在需要提示时调用 play：
 * const { prepare, play } = useSoundEffect({ sound: "success" });
 * play("error"); // 可临时覆盖默认提示音
 */
export function useSoundEffect({ sound = "notification", volume = 1 }: UseSoundEffectOptions = {}) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;

    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== "closed") return audioContext;

    const nextAudioContext = new AudioContext();
    audioContextRef.current = nextAudioContext;
    return nextAudioContext;
  }, []);

  // 在用户点击的同步调用链内恢复音频上下文，避免异步完成后被浏览器拦截播放。
  const prepare = useCallback(() => {
    const audioContext = getAudioContext();
    if (audioContext?.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }
  }, [getAudioContext]);

  const play = useCallback((soundEffect: SoundEffectName = sound) => {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const playTones = () => {
      if (audioContext.state !== "running") return;

      const normalizedVolume = Math.max(0, Math.min(1, volume));
      let startAt = audioContext.currentTime;

      for (const tone of SOUND_EFFECTS[soundEffect]) {
        startAt += tone.delay ?? 0;
        const endAt = startAt + tone.duration;
        const fadeDuration = Math.min(0.02, tone.duration / 2);
        const gain = audioContext.createGain();
        const oscillator = audioContext.createOscillator();
        const peakVolume = normalizedVolume * tone.volume;

        oscillator.type = tone.waveform;
        oscillator.frequency.setValueAtTime(tone.frequency, startAt);
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(peakVolume, startAt + fadeDuration);
        gain.gain.setValueAtTime(peakVolume, endAt - fadeDuration);
        gain.gain.linearRampToValueAtTime(0, endAt);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(endAt);
        startAt = endAt;
      }
    };

    if (audioContext.state === "suspended") {
      void audioContext.resume().then(playTones).catch(() => undefined);
      return;
    }

    playTones();
  }, [getAudioContext, sound, volume]);

  useEffect(() => {
    return () => {
      const audioContext = audioContextRef.current;
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined);
      }
    };
  }, []);

  return { prepare, play };
}
