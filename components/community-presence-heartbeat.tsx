"use client";

import { useEffect } from "react";

export default function CommunityPresenceHeartbeat() {
  useEffect(() => {
    let active = true;

    async function heartbeat() {
      if (!active || document.visibilityState !== "visible") return;
      try {
        await fetch("/api/community", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat" }),
          cache: "no-store",
        });
      } catch {
        // Presence is best-effort and expires automatically.
      }
    }

    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 20_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
        keepalive: true,
      });
    };
  }, []);

  return null;
}
