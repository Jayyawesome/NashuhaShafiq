import { forwardRef, memo, useCallback, useImperativeHandle, useRef } from "react";

export type AudioPlaybackState = "loading" | "ready" | "playing" | "paused" | "blocked" | "ended" | "error";
export type AudioProgress = { currentTime: number; duration: number; buffered: number };
export interface AudioControllerHandle {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
}

function PersistentAudioPlayerImpl(
  {
    src,
    startAt,
    onStateChange,
    onProgressChange,
  }: {
    src: string;
    startAt: number;
    onStateChange: (state: AudioPlaybackState) => void;
    onProgressChange: (progress: AudioProgress) => void;
  },
  ref: React.ForwardedRef<AudioControllerHandle>,
) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const reportProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const bufferedEnd = audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0;

    onProgressChange({
      currentTime,
      duration,
      buffered: duration > 0 ? Math.min(1, bufferedEnd / duration) : 0,
    });
  }, [onProgressChange]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    void audio.play().catch((error: DOMException) => {
      onStateChange(error.name === "NotAllowedError" ? "blocked" : "error");
    });
  }, [onStateChange]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.min(Math.max(0, seconds), duration || seconds);
    reportProgress();
  }, [reportProgress]);

  useImperativeHandle(ref, () => ({ play, pause, seek }), [pause, play, seek]);

  const startFromConfiguredTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = startAt >= 0 && startAt < duration ? startAt : 0;
    reportProgress();
  }, [reportProgress, startAt]);

  return (
    <audio
      ref={audioRef}
      className="persistent-audio-player"
      src={src}
      preload="auto"
      onLoadStart={() => onStateChange("loading")}
      onLoadedMetadata={startFromConfiguredTime}
      onCanPlay={() => {
        if (audioRef.current?.paused) onStateChange("ready");
        reportProgress();
      }}
      onPlay={() => onStateChange("playing")}
      onPause={() => onStateChange("paused")}
      onTimeUpdate={reportProgress}
      onDurationChange={reportProgress}
      onProgress={reportProgress}
      onEnded={() => {
        onStateChange("ended");
        startFromConfiguredTime();
        play();
      }}
      onError={() => onStateChange("error")}
    />
  );
}

export const PersistentAudioPlayer = memo(forwardRef(PersistentAudioPlayerImpl));
