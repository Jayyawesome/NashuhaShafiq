import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildYouTubeControllerUrl } from "../lib/music";

export type YouTubePlaybackState = "invalid" | "loading" | "ready" | "playing" | "paused" | "blocked" | "ended" | "error";
export interface YouTubeControllerHandle { play: () => void; pause: () => void }

const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
const PLAY_RETRY_INTERVAL = 400;
const PLAY_MAX_RETRIES = 4;
const BLOCKED_TIMEOUT = 3500;

function YouTubePlayerImpl(
  { youtubeUrl, startAt, endAt, onStateChange }: { youtubeUrl: string; startAt: string; endAt: string; onStateChange: (state: YouTubePlaybackState) => void },
  ref: React.ForwardedRef<YouTubeControllerHandle>
) {
  const src = useMemo(() => buildYouTubeControllerUrl(youtubeUrl, startAt, endAt), [youtubeUrl, startAt, endAt]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blockedTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const retryCount = useRef(0);
  const pendingPlay = useRef(false);
  const isPlaying = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const setState = useCallback((state: YouTubePlaybackState) => onStateChange(state), [onStateChange]);

  const command = useCallback((func: "playVideo" | "pauseVideo") => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      EMBED_ORIGIN
    );
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimer.current) { clearInterval(retryTimer.current); retryTimer.current = null; }
    retryCount.current = 0;
  }, []);

  const play = useCallback(() => {
    if (!src) { setState("invalid"); return; }
    pendingPlay.current = true;
    isPlaying.current = false;

    // Send immediate play command
    command("playVideo");

    // Set up retry: keep sending playVideo until we get a "playing" state response
    clearRetry();
    retryTimer.current = window.setInterval(() => {
      retryCount.current += 1;
      if (isPlaying.current || retryCount.current >= PLAY_MAX_RETRIES) {
        clearRetry();
        return;
      }
      command("playVideo");
    }, PLAY_RETRY_INTERVAL);

    // Blocked detection — if after all retries we still haven't played, show blocked state
    if (blockedTimer.current) clearTimeout(blockedTimer.current);
    blockedTimer.current = window.setTimeout(() => {
      if (!isPlaying.current) setState("blocked");
    }, BLOCKED_TIMEOUT);
  }, [src, command, clearRetry, setState]);

  const pause = useCallback(() => {
    pendingPlay.current = false;
    isPlaying.current = false;
    clearRetry();
    command("pauseVideo");
    setState("paused");
  }, [command, clearRetry, setState]);

  useImperativeHandle(ref, () => ({ play, pause }), [play, pause]);

  useEffect(() => {
    setLoaded(false);
    setState(src ? "loading" : "invalid");
  }, [setState, src]);

  useEffect(() => {
    const message = (event: MessageEvent) => {
      let urlObj: URL;
      try { urlObj = new URL(event.origin); } catch { return; }
      if (!/youtube(?:-nocookie)?\.com$/.test(urlObj.hostname)) return;
      let data: Record<string, unknown>;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      const info = data.info as { playerState?: number } | undefined;
      const playerState = info?.playerState;
      if (playerState === 1) {
        // Playing!
        if (blockedTimer.current) clearTimeout(blockedTimer.current);
        clearRetry();
        pendingPlay.current = false;
        isPlaying.current = true;
        setState("playing");
      }
      if (playerState === 2) { isPlaying.current = false; setState("paused"); }
      if (playerState === 0) { isPlaying.current = false; setState("ended"); }
      if (data.event === "onError") { isPlaying.current = false; setState("error"); }
    };
    window.addEventListener("message", message);
    return () => {
      window.removeEventListener("message", message);
      if (blockedTimer.current) clearTimeout(blockedTimer.current);
      clearRetry();
    };
  }, [setState, clearRetry]);

  if (!src) return null;

  return (
    <iframe
      ref={iframeRef}
      className="persistent-youtube-player"
      src={src}
      title="Persistent invitation music player"
      allow="autoplay; encrypted-media"
      onLoad={() => {
        setLoaded(true);
        setState("ready");
        // Send listening handshake
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: "jemput-player" }),
          EMBED_ORIGIN
        );
        // If play was requested before iframe loaded, start playing after a short delay
        // to let YouTube's internal API initialize
        if (pendingPlay.current) {
          setTimeout(() => play(), 300);
        }
      }}
      onError={() => setState("error")}
      data-loaded={loaded}
    />
  );
}

export const PersistentYouTubePlayer = memo(forwardRef(YouTubePlayerImpl));

