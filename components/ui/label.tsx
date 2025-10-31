"use client";

import type { LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}
