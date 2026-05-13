interface CardProps {
  children: React.ReactNode;
}

export function Card({ children }: CardProps) {
  return (
    <div className="flex h-full w-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-md">
      {children}
    </div>
  );
}

export function CardTitle({ children }: CardProps) {
  return <p className="text-title font-semibold">{children}</p>;
}

export function CardDescription({ children }: CardProps) {
  return <p className="text-secondary text-subtitle">{children}</p>;
}
