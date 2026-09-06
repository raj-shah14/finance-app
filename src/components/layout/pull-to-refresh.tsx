"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70; // px of pull needed to trigger a refresh
const MAX_PULL = 110; // px — resistance caps the visible pull past this
const RESISTANCE = 0.5;

/**
 * Custom pull-to-refresh for the installed PWA. iOS only gives you this
 * gesture for free inside a normal Safari tab (via the browser chrome) —
 * once "Add to Home Screen" drops that chrome, there's no native way to
 * pull-refresh a standalone web app, so this reimplements the gesture by
 * hand and falls back to a full reload (simplest way to guarantee every
 * page's data is actually fresh, since each page manages its own fetch).
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Only read/written inside event handlers, never during render — safe
  // to keep as a ref (unlike isPulling, which the render output needs).
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      // Only arm the gesture when already at the very top — otherwise this
      // would hijack normal scrolling anywhere else on the page.
      if (window.scrollY > 0) {
        startY.current = null;
        startX.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      setIsPulling(false);
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshing || startY.current === null || startX.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;
      // A swipe that's more horizontal than vertical (e.g. dragging a
      // scrollable chip row) isn't a pull — leave it for the browser's
      // native horizontal scroll instead of claiming it here.
      if (dy <= 0 || window.scrollY > 0 || Math.abs(dx) > Math.abs(dy)) {
        setIsPulling(false);
        setPull(0);
        return;
      }
      setIsPulling(true);
      // Prevent the page's own rubber-band bounce once we've committed to
      // treating this as a pull, so the two gestures don't fight.
      e.preventDefault();
      setPull(Math.min(dy * RESISTANCE, MAX_PULL));
    }

    function onTouchEnd() {
      setIsPulling((wasPulling) => {
        if (!refreshing && wasPulling) {
          setPull((p) => {
            if (p >= THRESHOLD) {
              setRefreshing(true);
              // A full reload is the simplest way to guarantee every
              // section of the page — each with its own independent
              // fetch — is actually current, rather than re-invoking a
              // dozen different fetchers.
              window.location.reload();
              return THRESHOLD;
            }
            return 0;
          });
        }
        return false;
      });
      startY.current = null;
      startX.current = null;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing]);

  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <>
      <div
        aria-hidden
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none"
        style={{ height: pull, transition: isPulling ? "none" : "height 0.2s ease" }}
      >
        <RefreshCw
          className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={{
            opacity: progress,
            transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
          }}
        />
      </div>
      <div
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: isPulling ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
