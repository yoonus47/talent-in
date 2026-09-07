/**
 * Next's loading.tsx convention: shown in place of a route's page.tsx while
 * that page's own server data is still resolving. app/feed and
 * app/dashboard didn't have one at all before this — since the root layout
 * (app/layout.tsx) already renders the navbar/shell as soon as its own
 * (fast, cached) profile check resolves, the *actual* blank few seconds
 * the user was staring at was this content area waiting on the page's
 * slower queries (getFeedPosts, etc.) with nothing to show in the
 * meantime. This fills that gap with the wordmark instead of nothing.
 *
 * Pure CSS — .brand-gradient-text and .brand-curtain-wipe both live in
 * app/globals.css — so no client JS is needed; the entrance animation just
 * plays once on mount, no interaction to wire up.
 */
export function BrandLoadingScreen() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <span className="brand-gradient-text brand-curtain-wipe text-4xl font-extrabold sm:text-5xl">
        TalentZify
      </span>
    </div>
  );
}
