"use client";

import dynamic from "next/dynamic";

// Decided at build time so production builds never emit the agentation chunk.
const Agentation = process.env.NODE_ENV === "development"
  ? dynamic(() => import("agentation").then((module) => module.Agentation), { ssr: false })
  : () => null;

export function AgentationDevTools() {
  if (process.env.NODE_ENV !== "development") return null;

  return <Agentation />;
}
