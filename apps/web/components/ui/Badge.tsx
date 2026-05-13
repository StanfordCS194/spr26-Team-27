import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "danger" | "warning" | "live";

const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-600",
  accent: "bg-primary-tint text-primary-accent-dark",
  danger: "bg-red-100 text-red-700",
  warning: "bg-orange-100 text-orange-700",
  live: "bg-red-50 text-red-600",
};

export function Badge({
  tone = "neutral",
  children,
  pulse,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
        TONES[tone],
        className,
      )}
    >
      {pulse ? (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}
