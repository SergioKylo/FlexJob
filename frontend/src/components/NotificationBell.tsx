import { useEffect, useRef, useState } from "react";
import { Bell, AlertCircle } from "lucide-react";

export type NotificationItem = {
  key: string;
  partnerId: number;
  partnerName: string;
  partnerAvatar?: string;
  jobId: number;
  jobTitle?: string;
  preview: string;
  time: string; // ISO timestamp of the last message
  isAdmin: boolean;
};

type NotificationBellProps = {
  notifications: NotificationItem[];
  lastSeen: string;
  onMarkSeen: () => void;
  onSelect: (item: NotificationItem) => void;
  emptyLabel: string;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function NotificationBell({ notifications, lastSeen, onMarkSeen, onSelect, emptyLabel }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.time > lastSeen).length;

  // Close when clicking anywhere outside the dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) onMarkSeen();
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button className="icon-button" onClick={toggle} aria-label="Notificações" style={{ position: "relative" }}>
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "-4px", right: "-4px",
            minWidth: "16px", height: "16px", padding: "0 4px", borderRadius: "8px",
            background: "#ef4444", color: "#fff", fontSize: "0.62rem", fontWeight: "800",
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            boxSizing: "border-box",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: "320px", maxWidth: "calc(100vw - 2rem)",
          maxHeight: "380px", overflowY: "auto", zIndex: 2500,
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}>
          {notifications.length === 0 ? (
            <p style={{ margin: 0, padding: "1.25rem", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>{emptyLabel}</p>
          ) : (
            notifications.map((n) => {
              const unread = n.time > lastSeen;
              return (
                <button
                  key={n.key}
                  onClick={() => { setOpen(false); onSelect(n); }}
                  style={{
                    display: "flex", gap: "0.6rem", alignItems: "flex-start", width: "100%", textAlign: "left",
                    padding: "0.7rem 0.9rem", background: unread ? "rgba(99,102,241,0.07)" : "none",
                    border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer",
                  }}
                >
                  {n.isAdmin ? (
                    <span style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <AlertCircle size={16} style={{ color: "#ef4444" }} />
                    </span>
                  ) : (
                    <img
                      src={n.partnerAvatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${n.partnerId}&radius=50`}
                      alt={n.partnerName}
                      style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                      <strong style={{ fontSize: "0.82rem", color: n.isAdmin ? "#ef4444" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.partnerName}
                      </strong>
                      <small style={{ marginLeft: "auto", color: "var(--muted)", fontSize: "0.68rem", flexShrink: 0 }}>{relativeTime(n.time)}</small>
                    </span>
                    <span style={{ display: "block", fontSize: "0.78rem", color: unread ? "var(--ink)" : "var(--muted)", fontWeight: unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {n.preview}
                    </span>
                  </span>
                  {unread && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: "6px" }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
