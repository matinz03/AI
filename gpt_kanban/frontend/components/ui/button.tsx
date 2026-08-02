import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-[#753991] text-white hover:bg-[#5e2d76] focus-visible:ring-[#753991]",
    secondary: "bg-[#209dd7] text-white hover:bg-[#1688bd] focus-visible:ring-[#209dd7]",
    ghost: "bg-transparent text-[#032147] hover:bg-[#eef3f8] focus-visible:ring-[#209dd7]",
    danger: "bg-[#b42318] text-white hover:bg-[#8f1d14] focus-visible:ring-[#b42318]",
  };
  return <button type={type} className={cn("inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], className)} {...props} />;
}
