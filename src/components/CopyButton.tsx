"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  ariaLabel,
  className = "btn btn-secondary btn-sm",
  compact = false,
  onCopied,
}: {
  /** The text to copy, or a function evaluated at click time. */
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  className?: string;
  /** Below the sm breakpoint show only the icon; the label stays as the accessible name. */
  compact?: boolean;
  /** Called after a successful copy. */
  onCopied?: () => void;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onClick() {
    const value = typeof text === "function" ? text() : text;
    const ok = await writeToClipboard(value);
    setState(ok ? "copied" : "failed");
    if (ok) onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const shown =
    state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : label;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} print:hidden`}
      aria-label={ariaLabel}
    >
      {state === "copied" ? (
        <CheckIcon className="size-4 text-pass" />
      ) : (
        <CopyIcon className="size-4" />
      )}
      <span
        aria-live="polite"
        className={compact ? "max-sm:sr-only" : undefined}
      >
        {shown}
      </span>
    </button>
  );
}
