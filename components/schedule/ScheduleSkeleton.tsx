/**
 * Painted the instant a navigation to a calendar page starts, instead of the
 * browser sitting on the previous screen while the server does its auth +
 * branches + materialize + schedule round-trips (see the loading.tsx files
 * that render this). Deliberately mirrors the real page's block sizes so the
 * swap-in doesn't shift anything.
 */
export function ScheduleSkeleton() {
  return (
    <div className="min-w-0 animate-pulse motion-reduce:animate-none" aria-hidden>
      <div className="mb-4 h-7 w-40 rounded-md bg-muted" />
      <div className="mb-4 h-24 rounded-xl border border-border bg-muted/40" />
      <div className="h-[28rem] rounded-xl border border-border bg-muted/30" />
    </div>
  )
}
