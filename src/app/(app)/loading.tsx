export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-softer" />
      <div className="h-24 animate-pulse rounded-xl bg-softer" />
      <div className="h-24 animate-pulse rounded-xl bg-softer" />
      <div className="h-24 animate-pulse rounded-xl bg-softer" />
    </div>
  );
}
