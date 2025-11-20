import { JSX, splitProps, ParentComponent } from "solid-js";
import { clsx } from "clsx";

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  icon?: any;
  iconPosition?: "left" | "right";
}

export const Button: ParentComponent<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "variant",
    "size",
    "icon",
    "iconPosition",
    "children",
    "class",
  ]);

  const variant = () => local.variant ?? "primary";
  const size = () => local.size ?? "md";
  const iconPosition = () => local.iconPosition ?? "left";

  const baseClasses =
    "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed border tracking-wide";

  const variantClasses = () => {
    switch (variant()) {
      case "primary":
        return "bg-transparent hover:bg-orange-500/10 text-white focus:ring-orange-500 border-orange-500 hover:border-orange-400 [&_svg]:text-orange-500";
      case "secondary":
        return "bg-transparent hover:bg-orange-500/5 text-orange-500 focus:ring-orange-500/50 border-orange-500/50 hover:border-orange-500 [&_svg]:text-orange-500";
      case "danger":
        return "bg-transparent hover:bg-danger/10 text-danger focus:ring-danger border-danger hover:border-danger/70 [&_svg]:text-danger";
      case "ghost":
        return "bg-transparent hover:bg-orange-500/10 text-orange-500 focus:ring-orange-500/50 border-transparent hover:border-orange-500/20 [&_svg]:text-orange-500";
      default:
        return "";
    }
  };

  const sizeClasses = () => {
    switch (size()) {
      case "sm":
        return "px-3 py-1.5 text-sm";
      case "md":
        return "px-4 py-2 text-base";
      case "lg":
        return "px-6 py-3 text-lg";
      default:
        return "";
    }
  };

  const iconSize = () => {
    switch (size()) {
      case "sm":
        return 16;
      case "md":
        return 20;
      case "lg":
        return 24;
      default:
        return 20;
    }
  };

  const Icon = local.icon;

  return (
    <button
      type="button"
      class={clsx(baseClasses, variantClasses(), sizeClasses(), local.class)}
      {...others}
    >
      {Icon && iconPosition() === "left" && <Icon size={iconSize()} />}
      {local.children}
      {Icon && iconPosition() === "right" && <Icon size={iconSize()} />}
    </button>
  );
};
