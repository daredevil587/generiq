"use client";

import { useRef, useState } from "react";
import { useZxing } from "react-zxing";
import { useRouter } from "next/navigation";

interface Props {
  onClose: () => void;
}

type Status = "scanning" | "loading" | "error";

const CORNER = "absolute w-6 h-6 border-white border-2";

export default function BarcodeScanner({ onClose }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("scanning");
  const [message, setMessage] = useState("");
  const scannedRef = useRef(false);

  const { ref: videoRef } = useZxing({
    onResult(result) {
      if (scannedRef.current) return;
      scannedRef.current = true;
      handleBarcode(result.getText());
    },
    onError(err) {
      if (scannedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("permission") || msg.includes("NotAllowed")) {
        setStatus("error");
        setMessage("Camera access denied. Please allow camera in browser settings.");
      }
    },
    constraints: { video: { facingMode: "environment" } },
    timeBetweenDecodingAttempts: 300,
    paused: status !== "scanning",
  });

  async function handleBarcode(barcode: string) {
    setStatus("loading");
    setMessage(barcode);
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcode)}`);
      const data = await res.json();
      if (data.found) {
        router.push(`/medicine/${data.id}`);
        onClose();
      } else if (data.name) {
        router.push(`/search?q=${encodeURIComponent(data.name)}`);
        onClose();
      } else {
        setStatus("error");
        setMessage("Product not found in our database. Try searching by name.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  function retry() {
    scannedRef.current = false;
    setStatus("scanning");
    setMessage("");
  }

  return (
    /* Outer — full-screen on mobile, dark overlay + centered card on sm+ */
    <div className="fixed inset-0 z-50 bg-black sm:bg-black/80 sm:flex sm:items-center sm:justify-center">
      {/* Backdrop click-to-close on desktop */}
      <div className="hidden sm:block absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Scanner card */}
      <div className="relative flex flex-col h-full sm:h-auto sm:w-[420px] sm:rounded-2xl sm:overflow-hidden bg-black">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Scan barcode</h2>
            <p className="text-white/50 text-xs mt-0.5">Point camera at product barcode</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative flex-1 sm:flex-none sm:h-[320px] bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {/* Dim surround + corner-frame overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark vignette */}
            <div className="absolute inset-0 bg-black/40" />
            {/* Frame cutout (transparent center) */}
            <div className="relative z-10 w-60 h-36">
              {/* Clear the dimming over the frame */}
              <div className="absolute inset-0 bg-transparent" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />
              {/* Corner brackets */}
              <span className={`${CORNER} top-0 left-0 border-r-0 border-b-0 rounded-tl-md`} />
              <span className={`${CORNER} top-0 right-0 border-l-0 border-b-0 rounded-tr-md`} />
              <span className={`${CORNER} bottom-0 left-0 border-r-0 border-t-0 rounded-bl-md`} />
              <span className={`${CORNER} bottom-0 right-0 border-l-0 border-t-0 rounded-br-md`} />
              {/* Sweep line */}
              {status === "scanning" && (
                <div
                  className="absolute left-1 right-1 h-px bg-[var(--color-brand)]"
                  style={{ animation: "scan 2s ease-in-out infinite" }}
                />
              )}
            </div>
          </div>

          {/* Loading overlay */}
          {status === "loading" && (
            <div className="absolute inset-0 bg-black/70 z-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">Looking up product…</p>
              <p className="text-white/40 text-xs font-mono">{message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-5 shrink-0 min-h-[80px] flex items-center justify-center">
          {status === "scanning" && (
            <p className="text-white/50 text-sm text-center">
              Supports EAN-13, UPC-A, QR codes and more
            </p>
          )}
          {status === "error" && (
            <div className="space-y-3 text-center w-full">
              <p className="text-red-400 text-sm leading-relaxed">{message}</p>
              <button
                onClick={retry}
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
