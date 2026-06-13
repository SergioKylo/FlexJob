import { toast } from "../utils/toast";
import { useEffect, useState, type ReactNode } from "react";
import {
  Users, Briefcase, MessageSquare, TrendingUp,
  Trash2, XCircle, Search, BarChart3, RefreshCw,
  LogOut, Star, AlertTriangle, ArrowLeft,
} from "lucide-react";
import { api } from "../utils/api";

// ── Types ────────────────────────────────────────────────────────────────────

type AdminStats = {
  userCount: number; workerCount: number; employerCount: number;
  totalJobs: number; activeJobs: number; totalMessages: number; revenue: number;
};
type AdminUser = {
  id: number; name: string; email: string; role: string;
  avatar?: string; bio?: string; rating: number; walletBalance: number; createdAt: string;
  warningCount?: number; banned?: boolean; bannedUntil?: string | null;
};
type AdminJob = {
  id: number; title: string; description: string; category: string; address: string;
  pay: number; status: string; paymentStatus: string; paymentAmount: number;
  employerName: string; workerName?: string; workDate?: string; createdAt: string;
};
type AdminMessage = {
  id: number; fromName: string; toName: string; jobTitle?: string;
  content: string; messageType: string; createdAt: string;
};
type AdminConv = {
  user1Id: number; user2Id: number; jobId?: number;
  user1Name: string; user2Name: string; jobTitle?: string;
  lastMessageAt: string; messageCount: number; reportCount: number;
};
type AdminConvMsg = {
  id: number; fromUserId: number; fromName: string;
  content: string; messageType: string; createdAt: string;
};
type Tab = "overview" | "users" | "jobs" | "messages";

// ── Constants ────────────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  restauracao: "Restauração", eventos: "Eventos",
  logistica: "Logística", casa: "Casa", retalho: "Retalho",
};

const STATUS_COLOR: Record<string, string> = {
  open: "#22c55e", accepted: "#3b82f6", completed: "#8b5cf6", closed: "#6b7280",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Aberta", accepted: "Aceite", completed: "Concluída", closed: "Fechada",
};
const ROLE_COLOR: Record<string, string> = {
  worker: "#22c55e", employer: "#3b82f6", admin: "#f59e0b",
};
const ROLE_LABEL: Record<string, string> = {
  worker: "Trabalhador", employer: "Empregador", admin: "Admin",
};

// ── Mini components ───────────────────────────────────────────────────────────

function Avatar({ src, name, size = 34 }: { src?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  if (src && !err) {
    return (
      <img src={src} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "var(--brand)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + "20", color, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function StatCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "18",
        display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

// ── Warning badge ─────────────────────────────────────────────────────────────

function WarningBadge({ count, banned, bannedUntil }: { count: number; banned: boolean; bannedUntil?: string | null }) {
  if (banned) {
    return (
      <span style={{
        padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 800,
        background: "rgba(239,68,68,0.18)", color: "#ef4444", whiteSpace: "nowrap",
        border: "1px solid rgba(239,68,68,0.35)",
      }}>{fmtBannedUntil(bannedUntil)}</span>
    );
  }
  if (count === 0) return null;
  const color = count >= 3 ? "#ef4444" : "#f59e0b";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + "20", color, whiteSpace: "nowrap",
      border: `1px solid ${color}40`,
    }}>⚠ {count}/3</span>
  );
}

// ── Helper: send message with isWarning flag (bypasses api.ts to add isWarning) ──

async function adminSendMessageRaw(
  toUserId: number,
  content: string,
  isWarning: boolean,
): Promise<{ message: string; warningCount?: number; banned?: boolean; bannedUntil?: string | null }> {
  const res = await fetch("/api/admin/send-message", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId, content, isWarning }),
  });
  if (!res.ok) {
    let msg = "Erro ao enviar mensagem.";
    try { const d = await res.json(); msg = d.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

// ── Helper: moderate user (removeWarning / unban) ─────────────────────────────

async function adminModerate(
  userId: number,
  action: "removeWarning" | "unban",
): Promise<{ message: string; warningCount: number; banned: boolean }> {
  const res = await fetch("/api/admin/users/moderate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, action }),
  });
  if (!res.ok) {
    let msg = "Erro ao moderar utilizador.";
    try { const d = await res.json(); msg = d.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

// ── Helper: format bannedUntil date ───────────────────────────────────────────

function fmtBannedUntil(bannedUntil?: string | null): string {
  if (!bannedUntil) return "BANIDO";
  try { return `Banido até ${new Date(bannedUntil).toLocaleDateString("pt-PT")}`; }
  catch { return "BANIDO"; }
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminPage({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [jobs, setJobs]       = useState<AdminJob[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [deletingUser, setDeletingUser] = useState<number | null>(null);
  const [deletingJob, setDeletingJob]   = useState<number | null>(null);
  const [closingJob, setClosingJob]     = useState<number | null>(null);

  // Conversation inbox (messages tab)
  const [convList, setConvList]           = useState<AdminConv[]>([]);
  const [selectedConv, setSelectedConv]   = useState<AdminConv | null>(null);
  const [convMessages, setConvMessages]   = useState<AdminConvMsg[]>([]);
  const [loadingConvMsgs, setLoadingConvMsgs] = useState(false);
  const [convFilter, setConvFilter]       = useState<"all" | "reported">("all");
  const [convError, setConvError]         = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs]   = useState(false);
  const [warnInput, setWarnInput]         = useState("");
  const [sendingWarn, setSendingWarn]     = useState(false);

  // User conversation panel (users tab) ───────────────────────────────────────
  const [userPanelTarget, setUserPanelTarget]     = useState<AdminUser | null>(null);
  const [userPanelMsgs, setUserPanelMsgs]         = useState<AdminConvMsg[]>([]);
  const [loadingUserPanel, setLoadingUserPanel]   = useState(false);
  const [userPanelInput, setUserPanelInput]       = useState("");
  const [sendingUserPanel, setSendingUserPanel]   = useState(false);
  const [adminId, setAdminId]                     = useState<number | null>(null);

  useEffect(() => { loadAll(false); }, []);

  // Fetch admin id once (needed to load admin ↔ user conversation)
  useEffect(() => {
    api.me().then((me) => { if (me.id) setAdminId(me.id); }).catch(() => {});
  }, []);

  // Load messages for user panel whenever target changes
  useEffect(() => {
    if (!userPanelTarget || !adminId) { setUserPanelMsgs([]); return; }
    setLoadingUserPanel(true);
    const user1Id = Math.min(adminId, userPanelTarget.id);
    const user2Id = Math.max(adminId, userPanelTarget.id);
    api.admin.getConversationMessages(user1Id, user2Id)
      .then((data) => { setUserPanelMsgs(data); setLoadingUserPanel(false); })
      .catch(() => setLoadingUserPanel(false));
  }, [userPanelTarget, adminId]);

  function loadConversations() {
    setConvError(null);
    setLoadingConvs(true);
    api.admin.getConversations()
      .then((data) => { setConvList(data); setLoadingConvs(false); })
      .catch((err) => {
        console.error("Admin conversations error:", err);
        setConvError(err?.message || "Erro ao carregar conversas. Reconstrói o Docker.");
        setLoadingConvs(false);
      });
  }

  useEffect(() => {
    if (tab === "messages") loadConversations();
  }, [tab]);

  useEffect(() => {
    if (!selectedConv) { setConvMessages([]); return; }
    setLoadingConvMsgs(true);
    api.admin.getConversationMessages(selectedConv.user1Id, selectedConv.user2Id, selectedConv.jobId ?? undefined)
      .then((data) => { setConvMessages(data); setLoadingConvMsgs(false); })
      .catch(() => setLoadingConvMsgs(false));
  }, [selectedConv]);

  async function loadAll(isRefresh = true) {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [s, u, j, m] = await Promise.all([
        api.admin.getStats(),
        api.admin.getUsers(),
        api.admin.getJobs(),
        api.admin.getMessages(),
      ]);
      setStats(s); setUsers(u); setJobs(j); setMessages(m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`Eliminar "${name}"? Esta ação é irreversível.`)) return;
    setDeletingUser(id);
    try {
      await api.admin.deleteUser(id);
      setUsers((p) => p.filter((u) => u.id !== id));
      if (stats) setStats({ ...stats, userCount: stats.userCount - 1 });
    } catch (e: any) { toast.error(e.message || "Erro ao eliminar."); }
    finally { setDeletingUser(null); }
  }

  async function deleteJob(id: number, title: string) {
    if (!confirm(`Eliminar vaga "${title}"? Esta ação é irreversível.`)) return;
    setDeletingJob(id);
    try {
      await api.admin.deleteJob(id);
      setJobs((p) => p.filter((j) => j.id !== id));
      if (stats) setStats({ ...stats, totalJobs: stats.totalJobs - 1 });
    } catch (e: any) { toast.error(e.message || "Erro ao eliminar."); }
    finally { setDeletingJob(null); }
  }

  async function closeJobAdmin(id: number) {
    setClosingJob(id);
    try {
      await api.admin.closeJob(id);
      setJobs((p) => p.map((j) => j.id === id ? { ...j, status: "closed" } : j));
      if (stats) setStats({ ...stats, activeJobs: Math.max(0, stats.activeJobs - 1) });
    } catch (e: any) { toast.error(e.message || "Erro ao fechar."); }
    finally { setClosingJob(null); }
  }

  // ── Old messages-tab send warning (kept for messages tab) ─────────────────
  async function handleSendWarning(toUserId: number) {
    if (!warnInput.trim() || !selectedConv) return;
    setSendingWarn(true);
    try {
      await adminSendMessageRaw(toUserId, warnInput.trim(), true);
      setWarnInput("");
      const data = await api.admin.getConversationMessages(
        selectedConv.user1Id, selectedConv.user2Id, selectedConv.jobId ?? undefined
      );
      setConvMessages(data);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar aviso.");
    } finally {
      setSendingWarn(false);
    }
  }

  // ── User panel: open conversation panel for a specific user ───────────────
  function openUserPanel(u: AdminUser) {
    setUserPanelTarget(u);
    setUserPanelInput("");
    setUserPanelMsgs([]);
  }

  // ── User panel: send normal message ───────────────────────────────────────
  async function handleUserPanelSend(isWarning: boolean) {
    if (!userPanelInput.trim() || !userPanelTarget || !adminId) return;

    if (isWarning) {
      const warnCount = (userPanelTarget.warningCount ?? 0) + 1;
      const confirmMsg = `Enviar aviso formal a "${userPanelTarget.name}"?\n\nEste aviso contará como ${warnCount}/3.${warnCount >= 3 ? "\n\nAO 3.º AVISO A CONTA SERÁ BANIDA!" : ""}`;
      if (!confirm(confirmMsg)) return;
    }

    setSendingUserPanel(true);
    try {
      const result = await adminSendMessageRaw(userPanelTarget.id, userPanelInput.trim(), isWarning);
      setUserPanelInput("");

      // Update user state (warningCount + banned + bannedUntil)
      if (isWarning && result.warningCount !== undefined) {
        const newCount = result.warningCount;
        const newBanned = result.banned ?? false;
        const newBannedUntil = result.bannedUntil ?? null;
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userPanelTarget.id
              ? { ...u, warningCount: newCount, banned: newBanned, bannedUntil: newBannedUntil }
              : u,
          ),
        );
        setUserPanelTarget((prev) =>
          prev ? { ...prev, warningCount: newCount, banned: newBanned, bannedUntil: newBannedUntil } : prev,
        );
        if (newBanned) {
          toast.error(`Utilizador banido após 3 avisos. ${newBannedUntil ? fmtBannedUntil(newBannedUntil) : ""}`);
        } else {
          toast.info(`Aviso enviado. Contador: ${newCount}/3`);
        }
      } else if (!isWarning) {
        toast.success("Mensagem enviada.");
      }

      // Reload conversation messages
      if (adminId) {
        const u1 = Math.min(adminId, userPanelTarget.id);
        const u2 = Math.max(adminId, userPanelTarget.id);
        const data = await api.admin.getConversationMessages(u1, u2);
        setUserPanelMsgs(data);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar mensagem.");
    } finally {
      setSendingUserPanel(false);
    }
  }

  // ── Moderation: remove warning / unban ───────────────────────────────────
  async function handleModerate(action: "removeWarning" | "unban") {
    if (!userPanelTarget) return;
    const confirmMsg = action === "removeWarning"
      ? `Remover 1 aviso de "${userPanelTarget.name}"?`
      : `Desbanir "${userPanelTarget.name}"? O contador ficará em 2/3.`;
    if (!confirm(confirmMsg)) return;
    try {
      const result = await adminModerate(userPanelTarget.id, action);
      const newCount = result.warningCount;
      const newBanned = result.banned;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userPanelTarget.id
            ? { ...u, warningCount: newCount, banned: newBanned, bannedUntil: newBanned ? u.bannedUntil : null }
            : u,
        ),
      );
      setUserPanelTarget((prev) =>
        prev ? { ...prev, warningCount: newCount, banned: newBanned, bannedUntil: newBanned ? prev.bannedUntil : null } : prev,
      );
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao moderar utilizador.");
    }
  }

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    const matchSearch = !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    const matchRole   = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });
  const filteredJobs = jobs.filter((j) => {
    const s = search.toLowerCase();
    const matchSearch  = !s || j.title.toLowerCase().includes(s) || j.employerName.toLowerCase().includes(s);
    const matchStatus  = statusFilter === "all" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "overview",  label: "Visão Geral",   icon: <BarChart3 size={15} /> },
    { key: "users",     label: `Utilizadores (${users.filter(u => u.role !== "admin").length})`, icon: <Users size={15} /> },
    { key: "jobs",      label: `Vagas (${jobs.length})`,       icon: <Briefcase size={15} /> },
    { key: "messages",  label: `Mensagens (${messages.length})`, icon: <MessageSquare size={15} /> },
  ];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center",
        height: "100vh", color: "var(--muted)", fontSize: 15 }}>
        A carregar painel de admin…
      </div>
    );
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header style={{
        background: "var(--surface)", borderBottom: "1px solid var(--line)",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: "var(--brand)", letterSpacing: -0.5 }}>FJ</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Admin</span>
          <Badge label="PAINEL" color="#f59e0b" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            style={{
              border: "none", background: "var(--surface2)", cursor: "pointer",
              borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
              color: "var(--muted)", fontSize: 13,
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Atualizar
          </button>
          <button className="secondary small" onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <nav style={{
        background: "var(--surface)", borderBottom: "1px solid var(--line)",
        padding: "0 20px", display: "flex", gap: 2, overflowX: "auto",
      }}>
        {TABS.map((t) => (
          <button key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); setUserPanelTarget(null); }}
            style={{
              padding: "13px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
              color: tab === t.key ? "var(--brand)" : "var(--muted)",
              borderBottom: tab === t.key ? "2px solid var(--brand)" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ════════════════════════════════ OVERVIEW ══════════════════════ */}
        {tab === "overview" && stats && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Visão Geral da Plataforma</h2>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 32 }}>
              <StatCard icon={<Users size={18} />}     label="Total Utilizadores" value={stats.userCount}    color="#3b82f6" />
              <StatCard icon={<Users size={18} />}     label="Trabalhadores"      value={stats.workerCount}  color="#22c55e" />
              <StatCard icon={<Briefcase size={18} />} label="Empregadores"       value={stats.employerCount} color="#8b5cf6" />
              <StatCard icon={<Briefcase size={18} />} label="Vagas Ativas"       value={stats.activeJobs}   color="#f59e0b" />
              <StatCard icon={<Briefcase size={18} />} label="Total de Vagas"     value={stats.totalJobs}    color="#6b7280" />
              <StatCard icon={<TrendingUp size={18} />} label="Receita Libertada" value={`€${stats.revenue.toFixed(0)}`} color="#ef4444" />
            </div>

            {/* Recent activity */}
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Atividade Recente</h3>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
              {messages.slice(0, 12).map((m, i) => (
                <div key={m.id} style={{
                  display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 16px",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: m.messageType !== "text" ? "#22c55e" : "var(--brand)",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: "var(--brand)" }}>{m.fromName}</span>
                      <span style={{ color: "var(--muted)", margin: "0 5px" }}>→</span>
                      {m.toName}
                      {m.jobTitle && <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>· {m.jobTitle}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.content}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{fmt(m.createdAt)}</span>
                </div>
              ))}
              {messages.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Sem atividade ainda.</div>
              )}
            </div>

            {/* Quick user overview */}
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "28px 0 12px" }}>Utilizadores Recentes</h3>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
              {users.filter(u => u.role !== "admin").slice(0, 8).map((u, i) => (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                }}>
                  <Avatar src={u.avatar} name={u.name} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                  </div>
                  <Badge label={ROLE_LABEL[u.role] || u.role} color={ROLE_COLOR[u.role] || "#6b7280"} />
                  <span style={{ fontSize: 13, color: "#f59e0b", flexShrink: 0 }}>
                    <Star size={12} style={{ verticalAlign: "middle" }} /> {u.rating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════ USERS ═════════════════════════ */}
        {tab === "users" && (
          <>
            {/* ── User conversation panel ───────────────────────────────── */}
            {userPanelTarget ? (
              <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 480 }}>
                {/* Panel header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 14, flexWrap: "wrap",
                }}>
                  <button
                    onClick={() => setUserPanelTarget(null)}
                    style={{
                      border: "1px solid var(--line)", background: "var(--surface2)",
                      borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      color: "var(--muted)", fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <ArrowLeft size={14} /> Voltar
                  </button>
                  <Avatar src={userPanelTarget.avatar} name={userPanelTarget.name} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {userPanelTarget.name}
                      <Badge label={ROLE_LABEL[userPanelTarget.role] || userPanelTarget.role} color={ROLE_COLOR[userPanelTarget.role] || "#6b7280"} />
                      <WarningBadge count={userPanelTarget.warningCount ?? 0} banned={userPanelTarget.banned ?? false} bannedUntil={userPanelTarget.bannedUntil} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{userPanelTarget.email}</div>
                  </div>
                  {/* Warning counter in header + moderation buttons */}
                  {!userPanelTarget.banned && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{
                        padding: "6px 14px", borderRadius: 10,
                        background: (userPanelTarget.warningCount ?? 0) >= 2 ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                        border: `1px solid ${(userPanelTarget.warningCount ?? 0) >= 2 ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                        fontSize: 13, fontWeight: 700,
                        color: (userPanelTarget.warningCount ?? 0) >= 2 ? "#ef4444" : "#f59e0b",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <AlertTriangle size={14} />
                        Avisos: {userPanelTarget.warningCount ?? 0}/3
                      </div>
                      {(userPanelTarget.warningCount ?? 0) > 0 && (
                        <button
                          onClick={() => handleModerate("removeWarning")}
                          style={{
                            padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: "1px solid rgba(245,158,11,0.5)", cursor: "pointer",
                            background: "rgba(245,158,11,0.1)", color: "#f59e0b",
                            display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          − Remover aviso
                        </button>
                      )}
                    </div>
                  )}
                  {userPanelTarget.banned && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{
                        padding: "6px 14px", borderRadius: 10,
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.4)",
                        fontSize: 13, fontWeight: 800, color: "#ef4444",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        {fmtBannedUntil(userPanelTarget.bannedUntil).toUpperCase()}
                      </div>
                      <button
                        onClick={() => handleModerate("unban")}
                        style={{
                          padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: "1px solid rgba(34,197,94,0.5)", cursor: "pointer",
                          background: "rgba(34,197,94,0.1)", color: "#22c55e",
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        Desbanir
                      </button>
                      {(userPanelTarget.warningCount ?? 0) > 0 && (
                        <button
                          onClick={() => handleModerate("removeWarning")}
                          style={{
                            padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: "1px solid rgba(245,158,11,0.5)", cursor: "pointer",
                            background: "rgba(245,158,11,0.1)", color: "#f59e0b",
                            display: "flex", alignItems: "center", gap: 4,
                          }}
                        >
                          − Remover aviso
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Message thread */}
                <div style={{
                  flex: 1, background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden",
                }}>
                  {/* Messages area */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {loadingUserPanel ? (
                      <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>A carregar mensagens...</div>
                    ) : userPanelMsgs.length === 0 ? (
                      <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>
                        <AlertTriangle size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                        <p style={{ margin: 0, fontSize: 14 }}>Sem mensagens ainda. Envie um aviso ou mensagem abaixo.</p>
                      </div>
                    ) : userPanelMsgs.map((msg) => {
                      const isFromAdmin = adminId !== null && msg.fromUserId === adminId;

                      // Admin warning — red highlighted card
                      if (msg.messageType === "admin_warning") {
                        return (
                          <div key={msg.id} style={{
                            border: "1.5px solid rgba(239,68,68,0.5)",
                            borderRadius: 12,
                            background: "rgba(239,68,68,0.07)",
                            padding: "10px 14px",
                          }}>
                            <div style={{
                              fontSize: 11, fontWeight: 800, color: "#ef4444",
                              marginBottom: 6, display: "flex", alignItems: "center", gap: 5,
                              textTransform: "uppercase", letterSpacing: 0.5,
                            }}>
                              <AlertTriangle size={13} /> AVISO DA ADMINISTRAÇÃO
                            </div>
                            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>{msg.content}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "right", marginTop: 4 }}>
                              {msg.fromName} · {new Date(msg.createdAt).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        );
                      }

                      // System events
                      if (msg.messageType !== "text") {
                        const color = msg.messageType === "payment_escrow" || msg.messageType === "payment_released" ? "#22c97a" : msg.messageType === "application" ? "#8b5cf6" : "#6366f1";
                        return (
                          <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                            <div style={{ padding: "6px 14px", borderRadius: 10, background: color + "18", border: `1px solid ${color}44`, maxWidth: "80%" }}>
                              <span style={{ fontSize: 12, color, fontWeight: 600 }}>{msg.fromName}: </span>
                              <span style={{ fontSize: 12, color: "var(--ink)" }}>{msg.content}</span>
                            </div>
                          </div>
                        );
                      }

                      // Normal text message
                      return (
                        <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isFromAdmin ? "flex-end" : "flex-start" }}>
                          <span style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2, paddingLeft: 4, paddingRight: 4 }}>{msg.fromName}</span>
                          <div style={{
                            maxWidth: "72%", padding: "8px 12px",
                            borderRadius: isFromAdmin ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                            background: isFromAdmin ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--surface2)",
                            color: isFromAdmin ? "#fff" : "var(--ink)",
                            border: isFromAdmin ? "none" : "1px solid var(--line)",
                          }}>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, wordBreak: "break-word" }}>{msg.content}</p>
                            <span style={{ display: "block", fontSize: 10, opacity: 0.55, marginTop: 3, textAlign: "right" }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Compose area */}
                  <div style={{
                    padding: "12px 14px", borderTop: "1px solid var(--line)",
                    background: "var(--surface)", flexShrink: 0,
                  }}>
                    <textarea
                      value={userPanelInput}
                      onChange={(e) => setUserPanelInput(e.target.value)}
                      placeholder="Escreva uma mensagem ou aviso..."
                      rows={2}
                      style={{
                        width: "100%", borderRadius: 8, border: "1px solid var(--line)",
                        background: "var(--bg)", color: "var(--ink)", fontSize: 13,
                        padding: "7px 10px", resize: "none", fontFamily: "inherit",
                        outline: "none", boxSizing: "border-box", marginBottom: 8,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Normal message button */}
                      <button
                        onClick={() => handleUserPanelSend(false)}
                        disabled={!userPanelInput.trim() || sendingUserPanel || (userPanelTarget.banned ?? false)}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 8,
                          border: "1px solid var(--line)", cursor: "pointer",
                          background: "var(--surface2)", color: "var(--ink)",
                          fontSize: 13, fontWeight: 600,
                          opacity: !userPanelInput.trim() || sendingUserPanel || (userPanelTarget.banned ?? false) ? 0.45 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        }}
                      >
                        <MessageSquare size={14} /> Enviar mensagem
                      </button>
                      {/* Formal warning button — hidden when banned */}
                      {!(userPanelTarget.banned ?? false) && (
                        <button
                          onClick={() => handleUserPanelSend(true)}
                          disabled={!userPanelInput.trim() || sendingUserPanel}
                          title="Envia aviso formal — conta para o limite de 3 antes do ban"
                          style={{
                            flex: 1, padding: "8px 12px", borderRadius: 8,
                            border: "2px solid #ef4444", cursor: "pointer",
                            background: "rgba(239,68,68,0.1)", color: "#ef4444",
                            fontSize: 13, fontWeight: 800,
                            opacity: !userPanelInput.trim() || sendingUserPanel ? 0.45 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          }}
                        >
                          <AlertTriangle size={14} /> Enviar aviso formal (conta +1)
                        </button>
                      )}
                    </div>
                    {(userPanelTarget.banned ?? false) && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444", fontWeight: 700, textAlign: "center" }}>
                        Utilizador banido — desbane primeiro para enviar avisos.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ── Normal users list ──────────────────────────────────── */}
                {/* Toolbar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Utilizadores <span style={{ color: "var(--muted)", fontWeight: 400 }}>({filteredUsers.length})</span>
                  </h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                      <input type="text" placeholder="Nome ou email…" value={search} onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, width: 200 }} />
                    </div>
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, cursor: "pointer" }}>
                      <option value="all">Todos</option>
                      <option value="worker">Trabalhadores</option>
                      <option value="employer">Empregadores</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "auto" }}>
                  {/* Header row */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "44px 1fr 180px 120px 70px 80px 110px auto 44px",
                    padding: "9px 16px", borderBottom: "1px solid var(--line)",
                    fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", gap: 10, minWidth: 780,
                  }}>
                    <span></span><span>Nome</span><span>Email</span><span>Função</span>
                    <span>Rating</span><span>Saldo</span><span>Criado</span><span>Avisos</span><span></span>
                  </div>

                  {filteredUsers.length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Nenhum utilizador encontrado.</div>
                  )}

                  {filteredUsers.map((u, i) => (
                    <div key={u.id} style={{
                      display: "grid", gridTemplateColumns: "44px 1fr 180px 120px 70px 80px 110px auto 44px",
                      padding: "11px 16px", alignItems: "center", gap: 10, minWidth: 780,
                      borderTop: i > 0 ? "1px solid var(--line)" : "none",
                      opacity: u.role === "admin" ? 0.55 : 1,
                    }}>
                      <Avatar src={u.avatar} name={u.name} size={32} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                        {u.bio && <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{u.bio}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                      <Badge label={ROLE_LABEL[u.role] || u.role} color={ROLE_COLOR[u.role] || "#6b7280"} />
                      <span style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>★ {u.rating.toFixed(1)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>€{u.walletBalance.toFixed(0)}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(u.createdAt)}</span>
                      {/* Warning badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
                        {u.role !== "admin" && (
                          <WarningBadge count={u.warningCount ?? 0} banned={u.banned ?? false} bannedUntil={u.bannedUntil} />
                        )}
                        {u.role !== "admin" && (
                          <button
                            onClick={() => openUserPanel(u)}
                            title="Abrir conversa / enviar aviso"
                            style={{
                              border: "1px solid rgba(239,68,68,0.4)",
                              background: "rgba(239,68,68,0.08)",
                              cursor: "pointer", padding: "3px 8px", borderRadius: 6,
                              color: "#ef4444", fontSize: 11, fontWeight: 700,
                              display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap",
                            }}
                          >
                            <AlertTriangle size={11} /> Avisar
                          </button>
                        )}
                      </div>
                      <div>
                        {u.role !== "admin" && (
                          <button onClick={() => deleteUser(u.id, u.name)} disabled={deletingUser === u.id}
                            title="Eliminar utilizador"
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 4, borderRadius: 6,
                              color: deletingUser === u.id ? "var(--muted)" : "#ef4444", opacity: deletingUser === u.id ? 0.5 : 1 }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════ JOBS ══════════════════════════ */}
        {tab === "jobs" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Vagas <span style={{ color: "var(--muted)", fontWeight: 400 }}>({filteredJobs.length})</span>
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input type="text" placeholder="Título ou empregador…" value={search} onChange={(e) => setSearch(e.target.value)}
                    style={{ padding: "8px 12px 8px 30px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, width: 220 }} />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, cursor: "pointer" }}>
                  <option value="all">Todos estados</option>
                  <option value="open">Aberta</option>
                  <option value="accepted">Aceite</option>
                  <option value="completed">Concluída</option>
                  <option value="closed">Fechada</option>
                </select>
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "auto" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 140px 110px 110px 60px 110px 72px",
                padding: "9px 16px", borderBottom: "1px solid var(--line)",
                fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", gap: 10, minWidth: 750,
              }}>
                <span>Título</span><span>Empregador</span><span>Categoria</span>
                <span>Estado</span><span>€/h</span><span>Data</span><span>Ações</span>
              </div>

              {filteredJobs.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Nenhuma vaga encontrada.</div>
              )}

              {filteredJobs.map((j, i) => (
                <div key={j.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 140px 110px 110px 60px 110px 72px",
                  padding: "12px 16px", alignItems: "center", gap: 10, minWidth: 750,
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  opacity: j.status === "closed" ? 0.45 : 1,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 1 }}>{j.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.address}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{j.employerName}</div>
                  <Badge label={CAT_LABELS[j.category] || j.category} color="#6366f1" />
                  <Badge label={STATUS_LABEL[j.status] || j.status} color={STATUS_COLOR[j.status] || "#6b7280"} />
                  <span style={{ fontSize: 14, fontWeight: 800 }}>€{j.pay}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{j.workDate || fmt(j.createdAt)}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    {j.status === "open" && (
                      <button onClick={() => closeJobAdmin(j.id)} disabled={closingJob === j.id}
                        title="Fechar vaga"
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 4, borderRadius: 6,
                          color: closingJob === j.id ? "var(--muted)" : "#f59e0b", opacity: closingJob === j.id ? 0.5 : 1 }}>
                        <XCircle size={15} />
                      </button>
                    )}
                    <button onClick={() => deleteJob(j.id, j.title)} disabled={deletingJob === j.id}
                      title="Eliminar vaga"
                      style={{ border: "none", background: "none", cursor: "pointer", padding: 4, borderRadius: 6,
                        color: deletingJob === j.id ? "var(--muted)" : "#ef4444", opacity: deletingJob === j.id ? 0.5 : 1 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════ MESSAGES ══════════════════════ */}
        {tab === "messages" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Conversas <span style={{ color: "var(--muted)", fontWeight: 400 }}>({convList.length})</span>
                {convList.some(c => c.reportCount > 0) && (
                  <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 12, fontWeight: 700 }}>
                    🚩 {convList.filter(c => c.reportCount > 0).length} reportada{convList.filter(c => c.reportCount > 0).length !== 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={loadConversations} disabled={loadingConvs}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: "var(--surface2)", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={12} style={{ animation: loadingConvs ? "spin 1s linear infinite" : "none" }} />
                  Atualizar
                </button>
                {(["all", "reported"] as const).map((f) => (
                  <button key={f} onClick={() => { setConvFilter(f); setSelectedConv(null); }}
                    style={{
                      padding: "6px 14px", borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: convFilter === f ? "var(--brand)" : "var(--surface2)",
                      color: convFilter === f ? "#fff" : "var(--muted)",
                    }}>
                    {f === "all" ? "Todas" : "🚩 Reportadas"}
                  </button>
                ))}
              </div>
            </div>

            {/* Two-panel inbox layout */}
            <div style={{ display: "flex", gap: 16, height: "calc(100vh - 220px)", minHeight: 400 }}>

              {/* Left: conversation list */}
              <div style={{
                width: 280, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--line)",
                borderRadius: 14, overflowY: "auto", display: "flex", flexDirection: "column",
              }}>
                {convError && (
                <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>⚠️ Erro ao carregar</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{convError}</div>
                  <button onClick={loadConversations}
                    style={{ marginTop: 6, fontSize: 11, padding: "3px 8px", borderRadius: 6,
                      border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
                      color: "#ef4444", cursor: "pointer" }}>
                    Tentar novamente
                  </button>
                </div>
              )}
              {loadingConvs && convList.length === 0 && !convError && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  A carregar conversas...
                </div>
              )}
              {convList
                  .filter(c => convFilter === "all" || c.reportCount > 0)
                  .map((conv) => {
                    const isActive = selectedConv?.user1Id === conv.user1Id && selectedConv?.user2Id === conv.user2Id && selectedConv?.jobId === conv.jobId;
                    return (
                      <button key={`${conv.user1Id}-${conv.user2Id}-${conv.jobId ?? "none"}`}
                        onClick={() => setSelectedConv(conv)}
                        style={{
                          display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px",
                          border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer", textAlign: "left",
                          background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                          borderLeft: isActive ? "3px solid var(--brand)" : "3px solid transparent",
                          transition: "background 0.12s",
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", flex: 1, lineHeight: 1.3 }}>
                            {conv.user1Name} ↔ {conv.user2Name}
                          </span>
                          {conv.reportCount > 0 && (
                            <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>
                              🚩 {conv.reportCount}
                            </span>
                          )}
                        </div>
                        {conv.jobTitle && (
                          <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            💼 {conv.jobTitle}
                          </span>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>{conv.messageCount} msg</span>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>{fmt(conv.lastMessageAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                {convList.filter(c => convFilter === "all" || c.reportCount > 0).length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    {convFilter === "reported" ? "Nenhuma conversa reportada." : "Sem conversas ainda."}
                  </div>
                )}
              </div>

              {/* Right: message thread */}
              <div style={{
                flex: 1, background: "var(--surface)", border: "1px solid var(--line)",
                borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden",
              }}>
                {selectedConv ? (
                  <>
                    {/* Thread header */}
                    <div style={{
                      padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex",
                      alignItems: "center", gap: 10, flexWrap: "wrap",
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                          {selectedConv.user1Name} ↔ {selectedConv.user2Name}
                        </span>
                        {selectedConv.jobTitle && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#6366f1", fontWeight: 600 }}>· 💼 {selectedConv.jobTitle}</span>
                        )}
                      </div>
                      {selectedConv.reportCount > 0 && (
                        <Badge label={`🚩 ${selectedConv.reportCount} reporte${selectedConv.reportCount !== 1 ? "s" : ""}`} color="#ef4444" />
                      )}
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {loadingConvMsgs ? (
                        <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>A carregar...</div>
                      ) : convMessages.length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>Sem mensagens nesta conversa.</div>
                      ) : convMessages.map((msg) => {
                        const isUser1 = msg.fromUserId === selectedConv.user1Id;

                        // Admin warning — red highlighted card
                        if (msg.messageType === "admin_warning") {
                          return (
                            <div key={msg.id} style={{
                              border: "1.5px solid rgba(239,68,68,0.5)",
                              borderRadius: 12,
                              background: "rgba(239,68,68,0.07)",
                              padding: "10px 14px",
                            }}>
                              <div style={{
                                fontSize: 11, fontWeight: 800, color: "#ef4444",
                                marginBottom: 6, display: "flex", alignItems: "center", gap: 5,
                                textTransform: "uppercase", letterSpacing: 0.5,
                              }}>
                                <AlertTriangle size={13} /> AVISO DA ADMINISTRAÇÃO
                              </div>
                              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>{msg.content}</div>
                              <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "right", marginTop: 4 }}>
                                {msg.fromName} · {new Date(msg.createdAt).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          );
                        }

                        // System events (payment, application, etc.)
                        if (msg.messageType !== "text") {
                          const color = msg.messageType === "payment_escrow" || msg.messageType === "payment_released" ? "#22c97a" : msg.messageType === "application" ? "#8b5cf6" : "#6366f1";
                          return (
                            <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                              <div style={{ padding: "6px 14px", borderRadius: 10, background: color + "18", border: `1px solid ${color}44`, maxWidth: "80%" }}>
                                <span style={{ fontSize: 12, color, fontWeight: 600 }}>{msg.fromName}: </span>
                                <span style={{ fontSize: 12, color: "var(--ink)" }}>{msg.content}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isUser1 ? "flex-start" : "flex-end" }}>
                            <span style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2, paddingLeft: 4, paddingRight: 4 }}>{msg.fromName}</span>
                            <div style={{
                              maxWidth: "72%", padding: "8px 12px", borderRadius: isUser1 ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                              background: isUser1 ? "var(--surface2)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                              color: isUser1 ? "var(--ink)" : "#fff",
                              border: isUser1 ? "1px solid var(--line)" : "none",
                            }}>
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, wordBreak: "break-word" }}>{msg.content}</p>
                              <span style={{ display: "block", fontSize: 10, opacity: 0.55, marginTop: 3, textAlign: "right" }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Admin warning compose */}
                    <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", background: "rgba(245,158,11,0.05)", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⚠️ Enviar Aviso</div>
                      <textarea
                        value={warnInput}
                        onChange={(e) => setWarnInput(e.target.value)}
                        placeholder="Escreva o aviso para o utilizador..."
                        rows={2}
                        style={{
                          width: "100%", borderRadius: 8, border: "1px solid var(--line)",
                          background: "var(--bg)", color: "var(--ink)", fontSize: 13,
                          padding: "7px 10px", resize: "none", fontFamily: "inherit",
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button
                          onClick={() => handleSendWarning(selectedConv!.user1Id)}
                          disabled={!warnInput.trim() || sendingWarn}
                          style={{
                            flex: 1, padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: "#f59e0b", color: "#000", fontSize: 12, fontWeight: 700,
                            opacity: !warnInput.trim() || sendingWarn ? 0.45 : 1,
                          }}
                        >
                          → {selectedConv!.user1Name}
                        </button>
                        <button
                          onClick={() => handleSendWarning(selectedConv!.user2Id)}
                          disabled={!warnInput.trim() || sendingWarn}
                          style={{
                            flex: 1, padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: "#f59e0b", color: "#000", fontSize: 12, fontWeight: 700,
                            opacity: !warnInput.trim() || sendingWarn ? 0.45 : 1,
                          }}
                        >
                          → {selectedConv!.user2Name}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", flexDirection: "column", gap: 10 }}>
                    <MessageSquare size={40} style={{ opacity: 0.2 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>Selecione uma conversa para ver as mensagens</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
