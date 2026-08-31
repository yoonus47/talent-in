"use client";

import { useState } from "react";
import { deleteAccount } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

/** Two-step in-page confirm — no native confirm() dialog — since this is
 * irreversible (deletes the account and everything it owns). */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">
        This can&apos;t be undone. Your profile, posts, comments, and everything else you&apos;ve
        added will be permanently deleted.
      </p>
      <div className="mt-3 flex gap-2">
        <form action={deleteAccount}>
          <SubmitButton variant="destructive" size="sm" pendingText="Deleting…">
            Yes, delete my account
          </SubmitButton>
        </form>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
