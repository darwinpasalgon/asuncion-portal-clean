"use client";
import { useEffect } from "react";

// Record visible portal visits, not clicks, page contents, or time worked.
export default function TeacherActivityHeartbeat() {
  useEffect(() => {
    let active = true;
    async function record() {
      if (!active || document.visibilityState !== "visible") return;
      try {
        await fetch("/api/teacher-activity", { method: "POST", cache: "no-store" });
      } catch {
        // Tracking must never interrupt portal work.
      }
    }
    void record();
    const timer = window.setInterval(() => void record(), 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void record(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
