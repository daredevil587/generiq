"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Status = "camera" | "processing" | "done" | "error";

const CORNER = "absolute w-7 h-7 border-white border-2";

export default function OcrScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("camera");
  const [capturedSrc, setCapturedSrc] = useState<string | null>(null);
  const [foundText, setFoundText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    // Draw frame to canvas at native resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    setCapturedSrc(canvas.toDataURL("image/jpeg", 0.9));
    setStatus("processing");
    stopCamera();

    await runOcr(canvas, ctx);
  }

  async function runOcr(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    try {
      // Downscale to max 1280px wide for faster OCR without quality loss
      let src: HTMLCanvasElement = canvas;
      const MAX = 1280;
      if (canvas.width > MAX) {
        const ratio = MAX / canvas.width;
        const small = document.createElement("canvas");
        small.width = MAX;
        small.height = Math.round(canvas.height * ratio);
        small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height);
        src = small;
      } else {
        // Pre-process: boost contrast for better OCR accuracy
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        boostContrast(imgData);
        ctx.putImageData(imgData, 0, 0);
      }

      // Dynamic import — Tesseract bundle only loads when scanner is opened
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: () => {} });
      const { data: { text } } = await worker.recognize(src);
      await worker.terminate();

      const query = parseQuery(text);
      if (!query) {
        setStatus("error");
        setErrorMsg("Couldn't read clear text. Try better lighting or hold the camera steady.");
        return;
      }

      setFoundText(query);
      setStatus("done");
      setTimeout(() => {
        router.push(`/search?q=${encodeURIComponent(query)}`);
        onClose();
      }, 900);
    } catch {
      setStatus("error");
      setErrorMsg("OCR failed. Please try again.");
    }
  }

  function boostContrast(imgData: ImageData) {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // Greyscale + contrast boost
      const avg = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      const v = Math.min(255, Math.max(0, (avg - 128) * 1.4 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }

  function parseQuery(raw: string): string {
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 3)
      .filter((l) => /[a-zA-Z]{2,}/.test(l))         // must contain letters
      .filter((l) => !/^[\d\s\W]+$/.test(l));          // not digits/symbols only

    if (!lines.length) return "";

    // Score each line: prefer medicine-keyword hits and moderate length
    const scored = lines.map((line) => {
      let score = 0;
      if (/\b(mg|ml|mcg|tablet|capsule|gel|cream|spray|drops|solution|suspension|vitamin|supplement|ingredient|contains|each|active)\b/i.test(line)) score += 3;
      if (line.length >= 5 && line.length <= 50) score += 2;
      if (/^[A-Z]/.test(line)) score += 1;            // starts with capital — likely a name
      return { line, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0].line;

    // Clean: strip special chars, take first 5 words
    return best
      .replace(/[^a-zA-Z0-9\s\-+]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 5)
      .join(" ");
  }

  function retry() {
    setCapturedSrc(null);
    setFoundText("");
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
              {status === "processing" && "Reading text from image…"}
              {status === "done"       && "Searching prices…"}
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

          {/* Guide frame overlay — camera mode only */}
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
            <div className="absolute inset-0 bg-black/55 z-10 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-white font-medium text-sm">Extracting text…</p>
                <p className="text-white/40 text-xs mt-1">May take a few seconds</p>
              </div>
            </div>
          )}

          {/* Done overlay */}
          {status === "done" && (
            <div className="absolute inset-0 bg-black/55 z-10 flex flex-col items-center justify-center gap-3 px-6">
              <div className="w-12 h-12 rounded-full bg-[var(--color-brand)] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs mb-1">Searching for</p>
                <p className="text-white font-semibold text-sm">&ldquo;{foundText}&rdquo;</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="px-5 py-5 shrink-0 min-h-[96px] flex flex-col items-center justify-center gap-3">

          {/* Capture button */}
          {status === "camera" && (
            <button
              onClick={capture}
              aria-label="Capture photo for OCR"
              className="w-16 h-16 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all shadow-lg flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full border-[3px] border-black/20" />
            </button>
          )}

          {/* Error state */}
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

          {/* Processing / done hint */}
          {(status === "processing" || status === "done") && (
            <p className="text-white/30 text-xs text-center">
              {status === "processing" ? "Tesseract OCR is reading the label…" : "Redirecting to results…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
