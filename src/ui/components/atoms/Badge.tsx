import { JSX, ParentComponent, splitProps } from "solid-js";
import { clsx } from "clsx";

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "danger" | "warning" | "info" | "neutral";
}

export const Badge: ParentComponent<BadgeProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "children", "class"]);

  const variant = () => local.variant ?? "neutral";

  const variantClasses = () => {
    switch (variant()) {
      case "success":
        return "bg-success/20 text-success border-success/30";
      case "danger":
        return "bg-danger/20 text-danger border-danger/30";
      case "warning":
        return "bg-warning/20 text-warning border-warning/30";
      case "info":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "neutral":
        return "bg-gray-700 text-gray-300 border-gray-600";
      default:
        return "";
    }
  };

  return (
    <span
      class={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variantClasses(),
        local.class
      )}
      {...others}
    >
      {local.children}
    </span>
  );
};
