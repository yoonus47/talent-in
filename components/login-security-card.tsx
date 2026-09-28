"use client";

import { useState } from "react";
import { updateEmail, updatePassword } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

/**
 * Email + password, each collapsed to a single read-only line with a
 * "Change" button until tapped — someone who lands on Account Settings
 * out of curiosity used to be greeted by three password fields with
 * nothing to change yet. Only the person who actually wants to change
 * something now sees a form at all, the same reveal-on-demand shape this
 * app already uses for comment replies and achievements' add/edit form.
 *
 * `defaultEditingEmail`/`defaultChangingPassword` come from
 * app/settings/page.tsx reading the `context` search param
 * lib/actions/account.ts's failWith sets on a validation failure — so a
 * rejected submit re-opens the same form with the error next to it,
 * instead of collapsing back and losing everything just typed.
 */
export function LoginSecurityCard({
  email,
  hasPassword,
  defaultEditingEmail,
  defaultChangingPassword,
}: {
  email: string;
  hasPassword: boolean;
  defaultEditingEmail: boolean;
  defaultChangingPassword: boolean;
}) {
  const [editingEmail, setEditingEmail] = useState(defaultEditingEmail);
  const [changingPassword, setChangingPassword] = useState(defaultChangingPassword);

  return (
    <>
      <div className="space-y-1.5">
        <Label>Email</Label>
        {!hasPassword ? (
          <>
            <Input value={email} disabled />
            <p className="text-xs text-muted-foreground">Managed by your Google account.</p>
          </>
        ) : editingEmail ? (
          <form action={updateEmail} className="space-y-2.5">
            <Input id="email" name="email" type="email" required defaultValue={email} autoFocus />
            <div className="space-y-1.5">
              <Label htmlFor="currentPasswordForEmail">Current password</Label>
              <Input
                id="currentPasswordForEmail"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-2">
              <SubmitButton variant="outline" size="sm" pendingText="Updating…">
                Save email
              </SubmitButton>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingEmail(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm text-foreground">{email}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setEditingEmail(true)}
            >
              Change
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        {!hasPassword ? (
          <div className="space-y-1.5">
            <Label>Password</Label>
            <p className="text-xs text-muted-foreground">Managed by your Google account.</p>
          </div>
        ) : changingPassword ? (
          <form action={updatePassword} className="space-y-2.5">
            <Label className="mb-0">Password</Label>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex gap-2">
              <SubmitButton variant="outline" size="sm" pendingText="Saving…">
                Save password
              </SubmitButton>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChangingPassword(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Label>Password</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
              Change password
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
