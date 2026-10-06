export function captureRefreshScroll(background: boolean) {
  if (!background || typeof window === "undefined") return null;
  return window.scrollY;
}

export function restoreRefreshScroll(scrollY: number | null) {
  if (scrollY === null || typeof window === "undefined") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
    });
  });
}
