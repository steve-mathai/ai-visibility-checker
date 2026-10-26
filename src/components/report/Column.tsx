import type { ReactNode } from "react";

/** The 1088px column (1136 with its 24px gutters) every report block sits in. */
export function Column({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1136px] px-6 ${className}`}>
      {children}
    </div>
  );
}
