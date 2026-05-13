import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "muted";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
}: Props) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-4 p-8 text-center ${
        tone === "muted" ? "text-secondary" : "text-primary"
      }`}
    >
      <div className="bg-primary-tint text-primary-accent flex h-14 w-14 items-center justify-center rounded-2xl text-2xl">
        {icon}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-primary text-base font-semibold">{title}</p>
        <p className="text-secondary max-w-xs text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
