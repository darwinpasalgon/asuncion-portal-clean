"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPortalAttention, type AttentionRole, type PortalAttentionData } from "@/lib/portal-attention";

const empty: PortalAttentionData = { personnel: null, adviser: null, error: false };
export default function usePortalAttention(userId: string | undefined, role: AttentionRole | undefined, isAdviser: boolean, pathname: string) {
  const [state, setState] = useState<PortalAttentionData & { userId: string; loading: boolean }>({ ...empty, userId: "", loading: false });
  const [retry, setRetry] = useState(0);
  const previous = useRef<{ userId: string; data: PortalAttentionData }>({ userId: "", data: empty });
  const refresh = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    if (!userId || !role) return;
    let active = true;
    let busy = false;
    let controller: AbortController | null = null;
    if (previous.current.userId !== userId) previous.current = { userId, data: empty };
    async function load() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 15_000);
      setState({ ...previous.current.data, userId: userId!, loading: true });
      try {
        const data = await fetchPortalAttention({ role: role!, isAdviser }, previous.current.data, fetch, controller.signal);
        if (active) {
          previous.current = { userId: userId!, data };
          setState({ ...data, userId: userId!, loading: false });
        }
      } catch {
        if (active) setState({ ...previous.current.data, userId: userId!, loading: false, error: true });
      } finally { busy = false; window.clearTimeout(timer); }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    window.addEventListener("anhs-portal-updated", refresh);
    return () => {
      active = false; controller?.abort(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      window.removeEventListener("anhs-portal-updated", refresh);
    };
  }, [userId, role, isAdviser, pathname, retry, refresh]);
  return { ...(state.userId === userId ? state : { ...empty, userId: userId ?? "", loading: Boolean(userId && role !== "student") }), refresh };
}

