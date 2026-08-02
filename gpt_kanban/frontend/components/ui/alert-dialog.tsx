"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";
import { Button } from "@/components/ui/button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

export function AlertDialogContent({ children }: { children: React.ReactNode }) {
  return <AlertDialogPrimitive.Portal><AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#032147]/35" /><AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">{children}</AlertDialogPrimitive.Content></AlertDialogPrimitive.Portal>;
}

export const AlertDialogTitle = AlertDialogPrimitive.Title;
export const AlertDialogDescription = AlertDialogPrimitive.Description;

export function AlertDialogAction(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <AlertDialogPrimitive.Action asChild><Button variant="danger" {...props} /></AlertDialogPrimitive.Action>;
}
