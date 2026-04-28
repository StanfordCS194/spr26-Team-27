import type { LinkComponent } from "@tanstack/react-router";
import { createLink } from "@tanstack/react-router";
import { type AnchorHTMLAttributes, type Ref } from "react";

const BasicLinkComponent = ({
  ref,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>;
}) => {
  return (
    <a
      ref={ref}
      {...props}
      className="bg-primary-accent text-primary-contr text-title w-fit rounded-2xl px-6 py-3 text-center font-semibold"
    >
      {props.children}
    </a>
  );
};

const CreatedLinkComponent = createLink(BasicLinkComponent);

export const PrimaryLink: LinkComponent<typeof BasicLinkComponent> = (
  props,
) => {
  return <CreatedLinkComponent preload={"intent"} {...props} />;
};
