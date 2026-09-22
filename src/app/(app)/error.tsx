"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-sub">Wren could not load this page. Your data is safe. Try again in a moment.</p>
      <button type="button" className="btn btn-primary mt-5" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
