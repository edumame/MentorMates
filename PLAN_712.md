# Issue #712 — Embed project demo video in judge view

## Goal
Let judges play a project's demo video inline from their judging deck without leaving the page.

## Plan
1. Extend `components/utils/VideoEmbed.tsx`:
   - Keep existing YouTube / Vimeo / Loom iframe support.
   - Add direct mp4/webm/mov detection -> render native `<video controls preload="metadata">`.
   - Add `loading="lazy"` to the iframe for lazy embedding.
   - Keep responsive 16:9 wrapper (already present via `pb-[56.25%]`).
   - Add graceful fallback ("Open video in new tab") for unknown URL shapes instead of `null`, so judges always have a way to view.
2. Integrate into judge dashboard (`features/user/dashboards/dashboard/judge/index.tsx`):
   - Render `<VideoEmbed url={currentProject.video_url} />` inside the Snapshot section of the judging card, above the cover image, so the video is the primary affordance when present.
   - Keep the existing "Video pitch" external link as a fallback chip.
3. Typecheck with `pnpm typecheck`, commit in chunks, push, mark PR #713 ready.

## URL formats supported
YouTube (watch, youtu.be, embed), Vimeo, Loom (share, embed), direct mp4/webm/mov, plus fallback link for anything else.
