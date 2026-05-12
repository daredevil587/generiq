"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ScanResult } from "@/app/api/scan/route";

type Status = "camera" | "processing" | "done" | "error";

const CORNER = "absolute w-7 h-7 border-white border-2";

export default function OcrScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status,      setStatus]      = useState<Status>("camera");
  const [capturedSrc, setCapturedSrc] = useState<string | null>(null);
  const [result,      setResult]      = useState<ScanResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setStatus("error");
      setErrorMsg("Camera access denied. Please allow camera access in your browser settings.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function capture() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    // Draw frame then downscale to max 1024px wide (keeps payload small, Vision API still reads fine print)
    const MAX = 1024;
    const ratio = Math.min(1, MAX / video.videoWidth);
    canvas.width  = Math.round(video.videoWidth  * ratio);
    canvas.height = Math.round(video.videoHeight * ratio);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedSrc(dataUrl);
    setStatus("processing");
    stopCamera();

    await analyzeImage(dataUrl);
  }

  async function analyzeImage(dataUrl: string) {
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Analysis failed. Please try again.");
        return;
      }

      const scan = data as ScanResult;
      const query = scan.name || scan.ingredients[0] || null;

      if (!query) {
        setStatus("error");
        setErrorMsg("Couldn't identify a medicine name. Try a clearer photo of the label.");
        return;
      }

      setResult(scan);
      setStatus("done");
      setTimeout(() => {
        router.push(`/search?q=${encodeURIComponent(query)}`);
        onClose();
      }, 1400);
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  function retry() {
    setCapturedSrc(null);
    setResult(null);
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
            <h2 className="text-white font-semibold text-base sm:text-lg">Scan medicine label</h2>
            <p className="text-white/50 text-xs mt-0.5">
              {status === "camera"     && "Point at medicine box or label, then tap Capture"}
              {status === "processing" && "Analysing image with AI…"}
              {status === "done"       && "Found — searching prices…"}
              {status === "error"      && "Scan failed"}
            </p>
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

        {/* Viewport */}
        <div className="relative flex-1 sm:flex-none sm:h-[320px] bg-black overflow-hidden">

          {/* Live camera */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity ${status === "camera" ? "opacity-100" : "opacity-0"}`}
            autoPlay
            playsInline
            muted
          />

          {/* Captured photo */}
          {capturedSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capturedSrc} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
          )}

          {/* Guide frame — camera mode */}
          {status === "camera" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative z-10 w-72 h-44">
                <div className="absolute inset-0" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} />
                <span className={`${CORNER} top-0 left-0 border-r-0 border-b-0 rounded-tl-lg`} />
                <span className={`${CORNER} top-0 right-0 border-l-0 border-b-0 rounded-tr-lg`} />
                <span className={`${CORNER} bottom-0 left-0 border-r-0 border-t-0 rounded-bl-lg`} />
                <span className={`${CORNER} bottom-0 right-0 border-l-0 border-t-0 rounded-br-lg`} />
                <p className="absolute -bottom-7 left-0 right-0 text-center text-white/60 text-xs">
                  Fit the label inside the frame
                </p>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {status === "processing" && (
            <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-white font-medium text-sm">AI is reading the label…</p>
                <p className="text-white/40 text-xs mt-1">Usually takes 2–4 seconds</p>
              </div>
            </div>
          )}

          {/* Done overlay */}
          {status === "done" && result && (
            <div className="absolute inset-0 bg-black/65 z-10 flex flex-col items-center justify-center gap-3 px-6">
              <div className="w-10 h-10 rounded-full bg-[var(--color-brand)] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center w-full">
                {result.name && (
                  <p className="text-white font-bold text-base leading-tight">{result.name}</p>
                )}
                {result.brand && result.brand !== result.name && (
                  <p className="text-white/60 text-xs mt-0.5">by {result.brand}</p>
                )}
                {result.ingredients.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {result.ingredients.slice(0, 4).map((ing) => (
                      <span key={ing} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full">
                        {ing}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="px-5 py-5 shrink-0 min-h-[96px] flex flex-col items-center justify-center gap-3">

          {status === "camera" && (
            <button
              onClick={capture}
              aria-label="Capture photo"
              className="w-16 h-16 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all shadow-lg flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full border-[3px] border-black/20" />
            </button>
          )}

          {status === "error" && (
            <>
              <p className="text-red-400 text-sm text-center leading-relaxed max-w-xs">{errorMsg}</p>
              <button
                onClick={retry}
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Try again
              </button>
            </>
          )}

          {(status === "processing" || status === "done") && (
            <p className="text-white/25 text-xs text-center">
              {status === "processing" ? "Powered by OpenAI Vision" : "Redirecting to search results…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
