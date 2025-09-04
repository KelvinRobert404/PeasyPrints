"use client";

import { useCallback, useRef, useState } from "react";

type SoundConfig = {
  chimeUrl: string;
  loopUrl: string;
};

/**
 * Web Audio based audio manager that supports a one-shot chime and a looping alert.
 * Requires a user gesture to enable on first use due to autoplay policies.
 */
export function useOrderAudio(config: SoundConfig = { chimeUrl: "/sounds/new-order.mp3", loopUrl: "/sounds/pending-loop.mp3" }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const loopSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const loopIntervalRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);

  const ensureContext = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) audioContextRef.current = new Ctor();
    }
    return audioContextRef.current;
  }, []);

  const enable = useCallback(async () => {
    const ctx = ensureContext();
    if (!ctx) return;
    try {
      await ctx.resume();
      setEnabled(true);
    } catch {
      // ignore
    }
  }, [ensureContext]);

  const loadBuffer = useCallback(async (url: string) => {
    try {
      const ctx = ensureContext();
      if (!ctx) return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch {
      return null;
    }
  }, [ensureContext]);

  const beep = useCallback(async (durationMs: number = 220, frequencyHz: number = 560) => {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequencyHz;
    const gain = ctx.createGain();
    // envelope to avoid clicks
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.02);
  }, [ensureContext]);

  const playChime = useCallback(async () => {
    if (!enabled) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const buffer = await loadBuffer(config.chimeUrl);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } else {
      await beep(240, 560);
    }
  }, [config.chimeUrl, enabled, ensureContext, loadBuffer, beep]);

  const startLoop = useCallback(async () => {
    if (!enabled || loopSourceRef.current || loopIntervalRef.current !== null) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const buffer = await loadBuffer(config.loopUrl);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(ctx.destination);
      source.start();
      loopSourceRef.current = source;
    } else {
      // Fallback: periodic beeps every 2 seconds
      loopIntervalRef.current = window.setInterval(() => {
        void beep(200, 520);
      }, 2000);
    }
  }, [config.loopUrl, enabled, ensureContext, loadBuffer, beep]);

  const stopLoop = useCallback(() => {
    if (loopSourceRef.current) {
      try { loopSourceRef.current.stop(); } catch {}
      try { loopSourceRef.current.disconnect(); } catch {}
      loopSourceRef.current = null;
    }
    if (loopIntervalRef.current !== null) {
      window.clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
  }, []);

  return { enable, enabled, playChime, startLoop, stopLoop } as const;
}


