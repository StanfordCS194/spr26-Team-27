import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

type Props = LinkProps & { children: ReactNode; className?: string };

export function PrimaryLink({ children, className, ...props }: Props) {
  return (
    <Link
      {...props}
      className={`bg-primary-accent text-primary-contr text-title w-fit rounded-2xl px-6 py-3 text-center font-semibold ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
