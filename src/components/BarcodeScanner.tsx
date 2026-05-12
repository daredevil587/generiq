"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// BarcodeDetector is a newer browser API not yet in TypeScript's stdlib
interface DetectedBarcode { rawValue: string }
declare class BarcodeDetector {
  constructor(opts?: { formats?: string[] });
  detect(src: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type Status = "camera" | "lookup" | "notfound" | "unsupported" | "error";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code", "data_matrix"];
const CORNER  = "absolute w-6 h-6 border-white border-2";

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const router       = useRouter();
  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const detectorRef  = useRef<InstanceType<typeof BarcodeDetector> | null>(null);
  const frameRef     = useRef<number>(0);
  const scannedRef   = useRef(false);

  const [status,       setStatus]       = useState<Status>("camera");
  const [barcode,      setBarcode]      = useState("");
  const [productName,  setProductName]  = useState("");   // from Open Food Facts
  const [searchInput,  setSearchInput]  = useState("");
  const [errorMsg,     setErrorMsg]     = useState("");

  useEffect(() => {
    init();
    return () => {
      cancelAnimationFrame(frameRef.current);
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    if (!("BarcodeDetector" in window)) {
      setStatus("unsupported");
      return;
    }
    try {
      detectorRef.current = new BarcodeDetector({ formats: FORMATS });
    } catch {
      setStatus("unsupported");
      return;
    }
    await startCamera();
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.addEventListener("loadedmetadata", () => {
          video.play().then(startScanLoop).catch(() => {});
        }, { once: true });
      }
    } catch {
      setStatus("error");
      setErrorMsg("Camera access denied. Please allow camera access in your browser settings.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function startScanLoop() {
    function loop() {
      const video    = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || scannedRef.current) return;

      detector.detect(video)
        .then((codes) => {
          if (codes.length > 0 && !scannedRef.current) {
            scannedRef.current = true;
            cancelAnimationFrame(frameRef.current);
            stopCamera();
            handleBarcode(codes[0].rawValue);
          } else if (!scannedRef.current) {
            frameRef.current = requestAnimationFrame(loop);
          }
        })
        .catch(() => {
          if (!scannedRef.current) frameRef.current = requestAnimationFrame(loop);
        });
    }
    frameRef.current = requestAnimationFrame(loop);
  }

  async function handleBarcode(code: string) {
    setBarcode(code);
    setStatus("lookup");
    try {
      const res  = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.found) {
        router.push(`/medicine/${data.id}`);
        onClose();
        return;
      }
      const name = (data.name as string | null) ?? "";
      setProductName(name);
      setSearchInput(name);
      setStatus("notfound");
    } catch {
      setProductName("");
      setSearchInput("");
      setStatus("notfound");
    }
  }

  function doSearch() {
    const q = searchInput.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onClose();
  }

  function retry() {
    scannedRef.current = false;
    setBarcode("");
    setProductName("");
    setSearchInput("");
    setErrorMsg("");
    setStatus("camera");
    startCamera();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black sm:bg-black/80 sm:flex sm:items-center sm:justify-center">
      {/* Backdrop close on desktop */}
      <div className="hidden sm:block absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Card */}
      <div className="relative flex flex-col h-full sm:h-auto sm:w-[420px] sm:rounded-2xl sm:overflow-hidden bg-black">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base sm:text-lg">Scan barcode</h2>
            <p className="text-white/50 text-xs mt-0.5">
              {status === "camera"      && "Point camera at product barcode"}
              {status === "lookup"      && "Looking up barcode…"}
              {status === "notfound"    && "Not in our database — search below"}
              {status === "unsupported" && "Enter barcode number manually"}
              {status === "error"       && "Camera unavailable"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Camera viewport (camera + lookup states) ─────────────────────── */}
        {(status === "camera" || status === "lookup") && (
          <div className="relative flex-1 sm:flex-none sm:h-[300px] bg-black overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />

            {/* Guide frame */}
            {status === "camera" && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="absolute inset-0 bg-black/35" />
                <div className="relative z-10 w-72 h-28">
                  <div className="absolute inset-0" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />
                  <span className={`${CORNER} top-0 left-0 border-r-0 border-b-0 rounded-tl-md`} />
                  <span className={`${CORNER} top-0 right-0 border-l-0 border-b-0 rounded-tr-md`} />
                  <span className={`${CORNER} bottom-0 left-0 border-r-0 border-t-0 rounded-bl-md`} />
                  <span className={`${CORNER} bottom-0 right-0 border-l-0 border-t-0 rounded-br-md`} />
                  <div
                    className="absolute left-1 right-1 h-px bg-[var(--color-brand)]"
                    style={{ animation: "scan 2s ease-in-out infinite" }}
                  />
                </div>
              </div>
            )}

            {/* Lookup overlay */}
            {status === "lookup" && (
              <div className="absolute inset-0 bg-black/65 z-10 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-white text-sm font-medium">Looking up barcode…</p>
                <p className="text-white/40 text-xs font-mono tracking-wider">{barcode}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer / result forms ─────────────────────────────────────────── */}
        <div className="px-5 py-5 shrink-0 flex flex-col gap-3 min-h-[110px] justify-center">

          {status === "camera" && (
            <p className="text-white/50 text-sm text-center">
              Supports EAN-13, UPC-A, QR codes and more
            </p>
          )}

          {/* Not found — search form pre-filled with Open Food Facts name */}
          {status === "notfound" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white/5 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Barcode</span>
                  <span className="text-white/60 font-mono">{barcode}</span>
                </div>
                {productName ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">Found online</span>
                    <span className="text-white/80 font-medium">{productName}</span>
                  </div>
                ) : (
                  <p className="text-white/40 text-xs">Not found in Open Food Facts either</p>
                )}
              </div>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search by name or ingredient…"
                autoFocus
                className="w-full bg-white/10 text-white placeholder-white/30 border border-white/20 focus:border-[var(--color-brand)] focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={doSearch}
                  disabled={!searchInput.trim()}
                  className="flex-1 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Search GeneriQ
                </button>
                <button
                  onClick={retry}
                  className="bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Scan again
                </button>
              </div>
            </div>
          )}

          {/* Unsupported browser — manual barcode entry */}
          {status === "unsupported" && (
            <div className="space-y-3">
              <p className="text-white/40 text-xs text-center leading-relaxed">
                Live barcode scanning isn&apos;t supported on this browser.<br />
                Enter the barcode number from the product.
              </p>
              <ManualInput onLookup={(code) => handleBarcode(code)} />
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3 text-center">
              <p className="text-red-400 text-sm leading-relaxed">{errorMsg}</p>
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

function ManualInput({ onLookup }: { onLookup: (code: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input
        type="text"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && val.trim() && onLookup(val.trim())}
        placeholder="e.g. 5011417563625"
        autoFocus
        className="flex-1 bg-white/10 text-white placeholder-white/30 border border-white/20 focus:border-[var(--color-brand)] focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-colors"
      />
      <button
        onClick={() => val.trim() && onLookup(val.trim())}
        disabled={!val.trim()}
        className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] disabled:opacity-40 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
      >
        Look up
      </button>
    </div>
  );
}
