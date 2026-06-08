"use client";

export default function CookieSettingsButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem("gq_cookie_consent");
        window.location.reload();
      }}
      className="hover:text-[var(--color-brand)] transition-colors cursor-pointer"
    >
      Cookie Settings
    </button>
  );
}
