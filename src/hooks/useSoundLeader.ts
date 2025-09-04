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
    const channel = new BroadcastChannel(channelName);
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
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [channelName, isLeader]);

  return { isLeader } as const;
}


