import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildYouTubeControllerUrl } from "../lib/music";

export type YouTubePlaybackState = "invalid" | "loading" | "ready" | "playing" | "paused" | "blocked" | "ended" | "error";
export interface YouTubeControllerHandle { play: () => void; pause: () => void }

function YouTubePlayerImpl({ youtubeUrl, startAt, endAt, onStateChange }: { youtubeUrl: string; startAt: string; endAt: string; onStateChange: (state: YouTubePlaybackState) => void }, ref: React.ForwardedRef<YouTubeControllerHandle>) {
  const src = useMemo(() => buildYouTubeControllerUrl(youtubeUrl, startAt, endAt), [youtubeUrl, startAt, endAt]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blockedTimer = useRef<number | null>(null);
  const pendingPlay = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const setState = useCallback((state: YouTubePlaybackState) => onStateChange(state), [onStateChange]);
  const command = (func: "playVideo" | "pauseVideo") => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "https://www.youtube-nocookie.com");
  const play = () => {
    if (!src) { setState("invalid"); return; }
    pendingPlay.current = true;
    command("playVideo");
    if (blockedTimer.current) clearTimeout(blockedTimer.current);
    blockedTimer.current = window.setTimeout(() => setState("blocked"), 1800);
  };
  const pause = () => { pendingPlay.current = false; command("pauseVideo"); setState("paused"); };
  useImperativeHandle(ref, () => ({ play, pause }));
  useEffect(() => {
    setLoaded(false);
    setState(src ? "loading" : "invalid");
  }, [setState, src]);
  useEffect(() => {
    const message = (event: MessageEvent) => {
      let urlObj: URL;
      try {
        urlObj = new URL(event.origin);
      } catch {
        return;
      }
      if (!/youtube(?:-nocookie)?\.com$/.test(urlObj.hostname)) return;
      let data: Record<string, unknown>;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      const info = data.info as { playerState?: number } | undefined;
      const playerState = info?.playerState;
      if (playerState === 1) { if (blockedTimer.current) clearTimeout(blockedTimer.current); pendingPlay.current = false; setState("playing"); }
      if (playerState === 2) setState("paused");
      if (playerState === 0) setState("ended");
      if (data.event === "onError") setState("error");
    };
    window.addEventListener("message", message);
    return () => { window.removeEventListener("message", message); if (blockedTimer.current) clearTimeout(blockedTimer.current); };
  }, [setState]);
  if (!src) return null;
  return <iframe ref={iframeRef} className="persistent-youtube-player" src={src} title="Persistent invitation music player" allow="autoplay; encrypted-media" onLoad={() => {
    setLoaded(true); setState("ready");
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "jemput-player" }), "https://www.youtube-nocookie.com");
    if (pendingPlay.current) play();
  }} onError={() => setState("error")} data-loaded={loaded} />;
}

export const PersistentYouTubePlayer = memo(forwardRef(YouTubePlayerImpl));
