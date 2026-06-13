import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2, Bell } from "lucide-react";
import { subscribeToasts, dismissToast, type Toast, type ToastType } from "../utils/toast";

const STYLES: Record<ToastType, { border: string; text: string; icon: JSX.Element }> = {
  error:   { border: "#ef4444", text: "#ef4444", icon: <AlertCircle size={16} /> },
  success: { border: "#10b981", text: "#10b981", icon: <CheckCircle2 size={16} /> },
  info:    { border: "#6366f1", text: "#a5b4fc", icon: <Bell size={16} /> },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);
  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", top: "70px", right: "1rem", zIndex: 3000, display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "340px", width: "calc(100vw - 2rem)" }}>
      {toasts.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: "0.5rem",
              padding: "0.75rem 0.9rem", borderRadius: "10px",
              background: "var(--surface)", border: `1px solid ${s.border}`,
              boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            }}
          >
            <span style={{ color: s.text, flexShrink: 0, marginTop: "1px" }}>{s.icon}</span>
            <span style={{ flex: 1, fontSize: "0.85rem", color: s.text, fontWeight: "600", lineHeight: "1.4" }}>{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Fechar"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
