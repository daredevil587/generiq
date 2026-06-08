import Link from "next/link";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import SavedProducts from "@/components/SavedProducts";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "Your Profile - GeneriQ",
  description: "View your saved products, price alerts and profile settings.",
  alternates: { canonical: `${siteUrl}/profile` },
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-[var(--color-brand-light)] text-[var(--color-brand)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-2">Sign in to sync</h1>
          <p className="text-[var(--color-muted)] max-w-md mx-auto">
            Sign in to access your watchlist across all your devices and set price-drop alerts.
          </p>
        </div>
        <Link 
          href="/login" 
          className="inline-block bg-[var(--color-brand)] text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 p-6 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          {session.user?.image ? (
            <img src={session.user.image} alt="" className="h-16 w-16 rounded-full border-2 border-[var(--color-brand)]" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-2xl text-white font-bold">
              {session.user?.name?.[0] || session.user?.email?.[0] || "?"}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
              {session.user?.name || "Member"}
            </h1>
            <p className="text-[var(--color-muted)] text-sm">
              {session.user?.email || session.user?.phone || "Signed in"}
            </p>
          </div>
        </div>
        
        <form action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}>
          <button className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors px-4 py-2 rounded-lg border border-red-100 hover:bg-red-50">
            Sign Out
          </button>
        </form>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--color-foreground)] mb-2">Your watchlist</h2>
        <p className="text-[var(--color-muted)]">
          Manage your saved medicines and health products.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <Link href="/search" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-brand)] transition-colors">
          <p className="font-semibold text-[var(--color-foreground)]">Find products</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">Search medicine, supplement and skincare prices.</p>
        </Link>
        <Link href="/basket" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-brand)] transition-colors">
          <p className="font-semibold text-[var(--color-foreground)]">Compare basket</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">Compare saved products together.</p>
        </Link>
        <Link href="/alerts" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-brand)] transition-colors">
          <p className="font-semibold text-[var(--color-foreground)]">Price alerts</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">View and manage your active price alerts.</p>
        </Link>
      </div>

      <SavedProducts />
    </div>
  );
}
