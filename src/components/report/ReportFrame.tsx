import type { ReactNode } from "react";
import { ViewerBar } from "./ViewerBar";
import styles from "./report.module.css";

/** Page-wide print rules that can't live in a CSS module (they target body and @page). */
const PRINT_RULES =
  "@media print { body { background: #ffffff !important; } @page { margin: 14mm; } }";

/** The viewer bar plus a body column. Every report state renders inside it. */
export function ReportFrame({
  children,
  showShare = false,
}: {
  children: ReactNode;
  showShare?: boolean;
}) {
  return (
    <div className={`${styles.root} bg-canvas`}>
      <style>{PRINT_RULES}</style>
      <ViewerBar showShare={showShare} />
      {children}
    </div>
  );
}
