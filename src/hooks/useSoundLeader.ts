"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Elects a single tab as the audio leader using BroadcastChannel heartbeats.
 * Only the leader tab should play audio.
 */
export function useSoundLeader(channelName: string = "swoop-audio") {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const lastHeartbeatAtMs = useRef<number>(0);

  useEffect(() => {
    // Fallback: if BroadcastChannel unsupported or throws, become leader locally
    let channel: BroadcastChannel | null = null;
    try {
      // @ts-expect-error: guard runtime support
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(channelName);
      }
    } catch {}

    if (!channel) {
      setIsLeader(true);
      return;
    }
    channelRef.current = channel;

    const onMessage = (event: MessageEvent) => {
      const data = (event as MessageEvent).data as any;
      if (data?.type === "heartbeat") {
        lastHeartbeatAtMs.current = Date.now();
      } else if (data?.type === "claim") {
        if (isLeader) channel.postMessage({ type: "heartbeat" });
      }
    };
    channel.addEventListener("message", onMessage);

    // Try to claim leadership
    channel.postMessage({ type: "claim" });
    const claimTimer = window.setTimeout(() => {
      if (Date.now() - lastHeartbeatAtMs.current > 2500) {
        setIsLeader(true);
      }
    }, 500);

    const heartbeatTimer = window.setInterval(() => {
      if (isLeader) channel.postMessage({ type: "heartbeat" });
    }, 1000);

    return () => {
      window.clearTimeout(claimTimer);
      window.clearInterval(heartbeatTimer);
      try { channel.removeEventListener("message", onMessage); } catch {}
      try { channel.close(); } catch {}
    };
  }, [channelName, isLeader]);

  return { isLeader } as const;
}


