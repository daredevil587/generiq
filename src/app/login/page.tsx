import AuthUI from "@/components/AuthUI";
import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - GeneriQ",
  description: "Sign in to GeneriQ to save products and track prices.",
  alternates: { canonical: `${siteUrl}/login` },
};

export default function LoginPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[var(--color-foreground)] mb-2">Sign in to GeneriQ</h1>
        <p className="text-[var(--color-muted)]">Track prices and save health essentials across all your devices.</p>
      </div>
      <AuthUI />
    </div>
  );
}
