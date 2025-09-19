"use client";

import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button({ className, variant = "default", ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={clsx("focus-ring", variant === "primary" ? "btn-primary" : "btn", className)}
      {...rest}
    />
  );
});

export default Button;
