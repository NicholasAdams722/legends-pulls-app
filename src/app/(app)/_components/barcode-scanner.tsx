"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (sku: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (cancelled || !result) return;
            const text = result.getText().trim();
            // SKU must be 5 digits
            const digits = text.replace(/\D/g, "");
            if (/^\d{5}$/.test(digits)) {
              cancelled = true;
              controls?.stop();
              onResult(digits);
            }
          },
        );
      } catch (err) {
        console.error("Camera error", err);
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="pt-safe flex items-center justify-between p-4 bg-black/80">
        <span className="text-sm text-zinc-300">Point camera at barcode</span>
        <button
          onClick={onClose}
          className="text-sm text-zinc-100 px-3 py-1 rounded bg-zinc-800"
        >
          Cancel
        </button>
      </div>
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3/4 h-24 border-2 border-emerald-400 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
