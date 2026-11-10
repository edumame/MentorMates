/** Above [id]/layout so its event/access lookup also streams behind this fallback. */
export default function EventsLoading() {
  return (
    <div className="w-full min-w-0 p-4 sm:p-8">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Loading event content…
      </p>
      <div aria-hidden="true" className="mt-6 space-y-6 motion-safe:animate-pulse">
        <div className="h-9 w-3/4 rounded-lg bg-slate-100" />
        <div className="h-5 w-1/2 rounded bg-slate-100" />
        <div className="h-48 w-full rounded-xl bg-slate-100" />
        <div className="h-5 w-full rounded bg-slate-100" />
        <div className="h-5 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}
