import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/landingPage/Card";

interface Props {
  who: string;
  title: string;
  description: string;
  features: {
    id: string;
    feature: string;
  }[];
}

function WhoItsForCard({ who, title, description, features }: Props) {
  return (
    <Card>
      <p
        className={`text-caption w-fit rounded-xl px-3 py-2 font-bold tracking-wider uppercase ${who === "Students" ? "bg-primary-tint text-primary-accent-dark" : "bg-secondary-tint text-secondary-accent-dark"}`}
      >
        {who}
      </p>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <div>
        {features.map((feature) => (
          <p key={feature.id} className="text-body flex gap-3 pb-3">
            <span className="text-primary-accent">✔</span>
            {feature.feature}
          </p>
        ))}
      </div>
    </Card>
  );
}

export default WhoItsForCard;
