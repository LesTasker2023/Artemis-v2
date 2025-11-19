import { JSX, ParentComponent, splitProps } from "solid-js";
import { clsx } from "clsx";

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  header?: JSX.Element;
  footer?: JSX.Element;
}

export const Card: ParentComponent<CardProps> = (props) => {
  const [local, others] = splitProps(props, [
    "header",
    "footer",
    "children",
    "class",
  ]);

  return (
    <div
      class={clsx(
        "bg-background-card rounded-lg overflow-hidden border border-primary/10 shadow-lg",
        local.class
      )}
      {...others}
    >
      {local.header && (
        <div class="px-6 py-4 border-b border-primary/10 bg-background-lighter/50">
          {local.header}
        </div>
      )}
      <div class="px-6 py-4">{local.children}</div>
      {local.footer && (
        <div class="px-6 py-4 border-t border-primary/10 bg-background-lighter/50">
          {local.footer}
        </div>
      )}
    </div>
  );
};
