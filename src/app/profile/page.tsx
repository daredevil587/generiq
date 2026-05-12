import Link from "next/link";

export default function ProfilePage() {
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-6">
        <svg className="w-7 h-7 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-foreground)] mb-3">Your Profile</h1>
      <p className="text-[var(--color-muted)] mb-2">
        Save your favourite medicines, track prices and set your country preferences.
      </p>
      <p className="text-sm text-[var(--color-muted)] mb-8">
        Accounts are coming soon — no sign-up needed to compare prices today.
      </p>
      <Link href="/" className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
        Browse medicines
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
