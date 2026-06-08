"use client";

import { useState, useEffect } from "react";
import { signIn, getProviders } from "next-auth/react";

type Provider = { id: string; name: string };

export default function AuthUI() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [devMsg, setDevMsg] = useState("");

  useEffect(() => {
    getProviders().then((p) => {
      if (p) {
        setProviders(
          Object.values(p as Record<string, Provider>).filter(
            (v) => v.id !== "phone-otp"
          )
        );
      }
    });
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDevMsg("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
        headers: { "Content-Type": "application/json" },
      });

      const data = (await res.json()) as { error?: string; dev?: boolean; message?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      if (data.dev) {
        setDevMsg(data.message || "OTP logged to server console (dev mode)");
      }
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("phone-otp", {
      phone,
      otp,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid code. Please try again.");
      setLoading(false);
    } else {
      window.location.href = "/profile";
    }
  };

  const handleOAuthSignIn = async (providerId: string) => {
    try {
      await signIn(providerId, { callbackUrl: "/profile" });
    } catch {
      setError(`Sign in with ${providerId} failed. Please try again.`);
    }
  };

  const googleAvailable = providers.some((p) => p.id === "google");
  const facebookAvailable = providers.some((p) => p.id === "facebook");

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-xl">
      <h2 className="text-2xl font-bold text-center mb-6">Welcome to GeneriQ</h2>

      {/* OAuth buttons */}
      <div className="space-y-4 mb-6">
        {googleAvailable ? (
          <button
            onClick={() => handleOAuthSignIn("google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-brand-light)] transition-colors font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-dashed border-[var(--color-border)] rounded-xl text-[var(--color-muted)] text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Google — add AUTH_GOOGLE_ID to .env.local
          </div>
        )}

        {facebookAvailable ? (
          <button
            onClick={() => handleOAuthSignIn("facebook")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-brand-light)] transition-colors font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-dashed border-[var(--color-border)] rounded-xl text-[var(--color-muted)] text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Facebook — add AUTH_FACEBOOK_ID to .env.local
          </div>
        )}
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[var(--color-border)]"></span></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-[var(--color-surface)] px-2 text-[var(--color-muted)]">Or phone number</span></div>
      </div>

      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-muted)]">Phone Number</label>
            <input
              type="tel"
              placeholder="+44 7123 456789"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--color-brand)] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-muted)]">Verification Code</label>
            <input
              type="text"
              placeholder="123456"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-center text-2xl tracking-widest focus:ring-2 focus:ring-[var(--color-brand)] outline-none transition-all"
            />
          </div>
          {devMsg && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Dev mode: {devMsg}. Check your terminal for the code.
            </p>
          )}
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--color-brand)] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Verifying..." : "Sign In"}
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
          >
            Change phone number
          </button>
        </form>
      )}
    </div>
  );
}
