import type { ReactNode } from "react";
import type { CheckStatus } from "@/lib/audit/types";

type IconProps = { className?: string };

function Svg({
  className = "size-5",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const STATUS_META: Record<CheckStatus, { label: string; className: string }> = {
  pass: { label: "Passed", className: "text-pass" },
  warn: { label: "Needs work", className: "text-warn" },
  fail: { label: "Failed", className: "text-fail" },
  info: { label: "Note", className: "text-info" },
};

export function StatusIcon({
  status,
  className = "size-5",
}: {
  status: CheckStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 ${meta.className}`}>
      <Svg className={className}>
        {status === "pass" && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.7 2.7L16 9.5" />
          </>
        )}
        {status === "warn" && (
          <>
            <path d="M12 3.5l9.5 16.5h-19z" />
            <path d="M12 10v4M12 17v.01" />
          </>
        )}
        {status === "fail" && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </>
        )}
        {status === "info" && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.01" />
          </>
        )}
      </Svg>
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CrossIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </Svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function ExternalIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function Spinner({ className = "size-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoMark({ className = "size-7" }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <circle
        cx="15"
        cy="15"
        r="6"
        fill="none"
        stroke="var(--accent-fg)"
        strokeWidth="2.6"
      />
      <path
        d="M19.5 19.5 25 25"
        stroke="var(--accent-fg)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Category icons for the landing page. */
export function CategoryIcon({
  id,
  className = "size-6",
}: {
  id: string;
  className?: string;
}) {
  return (
    <Svg className={className}>
      {id === "crawlability" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
        </>
      )}
      {id === "structured-data" && (
        <path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3" />
      )}
      {id === "content" && <path d="M4 6h16M4 12h10M4 18h14" />}
      {id === "entity" && (
        <>
          <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      )}
      {id === "meta" && (
        <>
          <path d="M3 12V4h8l10 10-8 8L3 12z" />
          <circle cx="7.5" cy="8.5" r="1.2" />
        </>
      )}
      {id === "fixes" && (
        <>
          <path d="M4 6h10M4 12h7M4 18h5" />
          <path d="M16 15l2.5 2.5L23 12" />
        </>
      )}
    </Svg>
  );
}
