"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Drop-in replacement for <Button type="submit"> that disables itself and
 * shows a pending label while its parent form's action is running —
 * prevents double-submits on the slower actions (uploads, account changes).
 */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
