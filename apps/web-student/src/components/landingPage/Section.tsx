interface Props {
  children: React.ReactNode;
  center?: boolean;
  contrast?: boolean;
}

export function SectionContainer({ children, center, contrast }: Props) {
  return (
    <div
      className={`flex flex-col justify-center px-6 py-10 sm:px-12 md:px-18 md:py-20 lg:px-24 xl:px-32 ${center ? "items-center" : ""} ${contrast ? "bg-primary-bg-contr" : "bg-primary-bg"} w-full`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ children, center, contrast }: Props) {
  return (
    <h2
      className={`text-primary-accent text-subtitle pb-3 font-bold tracking-wider uppercase ${center ? "text-center" : ""} ${contrast ? "text-primary-accent-contr" : "text-primary-accent"}`}
    >
      {children}
    </h2>
  );
}

export function SectionSubheading({ children, center, contrast }: Props) {
  return (
    <h3
      className={`text-primary text-display font-display pb-6 font-bold ${center ? "text-center" : ""} ${contrast ? "text-primary-contr" : "text-primary"}`}
    >
      {children}
    </h3>
  );
}

export function SectionDescription({ children, center, contrast }: Props) {
  return (
    <p
      className={`text-secondary text-title pb-12 ${center ? "text-center" : ""} ${contrast ? "text-secondary-contr" : "text-secondary"}`}
    >
      {children}
    </p>
  );
}

export function AccentText({ children, contrast }: Props) {
  return (
    <span
      className={`italic ${contrast ? "text-primary-accent-contr" : "text-primary-accent"}`}
    >
      {children}
    </span>
  );
}
