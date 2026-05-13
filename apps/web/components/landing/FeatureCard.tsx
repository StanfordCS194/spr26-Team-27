import { Card, CardDescription, CardTitle } from "@/components/landing/Card";

interface Props {
  icon: string;
  feature: string;
  description: string;
}

export default function FeatureCard({ icon, feature, description }: Props) {
  return (
    <Card>
      <p className="bg-primary-tint flex w-fit items-center justify-center rounded-xl p-3 text-2xl">
        {icon}
      </p>
      <CardTitle>{feature}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </Card>
  );
}
