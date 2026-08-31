import { createPost } from "@/lib/actions/posts";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/submit-button";
import { PostImagePicker } from "@/components/post-image-picker";
import type { Profile } from "@/lib/types/database";

export function Composer({ profile }: { profile: Profile }) {
  return (
    <Card className="p-4">
      <form action={createPost} className="flex gap-3">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={40} />
        <div className="flex-1 space-y-2">
          <Textarea
            name="content"
            placeholder="Share a win, a question, or what you're working on…"
            maxLength={1000}
            required
            className="min-h-16"
          />
          <PostImagePicker />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingText="Posting…">
              Post
            </SubmitButton>
          </div>
        </div>
      </form>
    </Card>
  );
}
