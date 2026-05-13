import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-primary-contr border-divider flex flex-col rounded-2xl border shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  right,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-divider flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5",
        className,
      )}
    >
      <h3 className="text-primary text-sm font-semibold tracking-tight">
        {title}
      </h3>
      {right ? (
        <div className="text-secondary flex shrink-0 items-center gap-2 text-xs">
          {right}
        </div>
      ) : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {children}
    </div>
  );
}
