interface Props {
  idx: number;
  title: string;
  description: string;
}

function HowItWorksItem({ idx, title, description }: Props) {
  return (
    <div className="flex gap-6">
      <div>
        <p className="font-display text-title text-primary-accent-contr border-primary-accent-contr flex aspect-square items-center justify-center rounded-full border px-4 italic">
          {idx}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-primary-contr text-title font-semibold">{title}</p>
        <p className="text-secondary-contr text-subtitle">{description}</p>
      </div>
    </div>
  );
}

export default HowItWorksItem;
