"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type ToastTone = "success" | "info";
type ToastMessage = { id: number; text: string; tone: ToastTone };

type ToastApi = {
  show: (text: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback so calls don't crash if rendered outside the provider.
    return { show: () => {} };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const show = useCallback((text: string, tone: ToastTone = "success") => {
    idRef.current += 1;
    const id = idRef.current;
    setMessages((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 1200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {messages.length > 0 && (
        <div
          className="fixed left-4 right-4 z-30 flex flex-col gap-2 pointer-events-none"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              role="status"
              className={`pointer-events-auto rounded-xl px-4 py-3 text-base font-semibold shadow-lg ${
                m.tone === "success"
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-900 border border-zinc-200"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
