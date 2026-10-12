'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-shell">
    <section className="premium-card max-w-xl rounded-3xl p-8">
      <h1 className="font-display text-3xl">This page could not load</h1>
      <p role="alert" className="mt-3 text-sm text-[#657067]">Please try again or open the page directly.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="button-primary" onClick={reset}>Try again</button>
        <button type="button" className="button-secondary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </section>
  </main>;
}
