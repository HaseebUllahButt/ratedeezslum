"use client";

import { useEffect, useRef, useState } from "react";

type ShareStatus = "idle" | "working" | "copied" | "shared" | "error";

function isMobileDevice(): boolean {
  const mobileNavigator = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

  return (
    mobileNavigator.userAgentData?.mobile ??
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
  );
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy copy path if clipboard permission is denied.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable");
}

export default function ShareButton() {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  function showStatus(nextStatus: ShareStatus) {
    setStatus(nextStatus);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (nextStatus !== "working") {
      resetTimerRef.current = setTimeout(() => setStatus("idle"), 2200);
    }
  }

  async function handleShare() {
    showStatus("working");
    const url = window.location.href;

    try {
      if (isMobileDevice() && typeof navigator.share === "function") {
        await navigator.share({ url });
        showStatus("shared");
      } else {
        await copyToClipboard(url);
        showStatus("copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        showStatus("idle");
        return;
      }
      showStatus("error");
    }
  }

  const label =
    status === "working"
      ? "Sharing..."
      : status === "copied"
        ? "Link copied"
        : status === "shared"
          ? "Shared"
          : status === "error"
            ? "Could not share"
            : "Share";

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={status === "working"}
      aria-label="Share professor profile"
      className="inline-flex shrink-0 items-center justify-center gap-2 border border-lums-navy px-3 py-2 text-xs font-bold uppercase tracking-wide text-lums-navy transition-colors hover:bg-lums-navy hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lums-navy disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.478 9 12c0-.478-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684 6.632 3.316m-6.632-6 6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span aria-live="polite">{label}</span>
    </button>
  );
}
