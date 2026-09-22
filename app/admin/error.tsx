"use client";

export default function Error({ retry }: { retry: () => void }) {
  return <main id="platform-admin-error" className="rounded-xl border border-admin-border bg-admin-surface p-6"><h1 className="text-xl font-medium">Platform data is unavailable</h1><p role="alert" className="mt-2 text-sm text-admin-text-secondary">Please try again. If this persists, verify the database migration and server configuration.</p><button id="platform-admin-retry" onClick={retry} className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-sm text-white">Try again</button></main>;
}
