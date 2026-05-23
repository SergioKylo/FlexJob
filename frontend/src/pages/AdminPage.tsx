import { useEffect, useState, type ReactNode } from "react";
import {
  Users, Briefcase, MessageSquare, TrendingUp,
  Trash2, XCircle, Search, BarChart3, RefreshCw,
  LogOut, Star,
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

  useEffect(() => { loadAll(false); }, []);

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
    } catch (e: any) { alert(e.message || "Erro ao eliminar."); }
    finally { setDeletingUser(null); }
  }

  async function deleteJob(id: number, title: string) {
    if (!confirm(`Eliminar vaga "${title}"? Esta ação é irreversível.`)) return;
    setDeletingJob(id);
    try {
      await api.admin.deleteJob(id);
      setJobs((p) => p.filter((j) => j.id !== id));
      if (stats) setStats({ ...stats, totalJobs: stats.totalJobs - 1 });
    } catch (e: any) { alert(e.message || "Erro ao eliminar."); }
    finally { setDeletingJob(null); }
  }

  async function closeJobAdmin(id: number) {
    setClosingJob(id);
    try {
      await api.admin.closeJob(id);
      setJobs((p) => p.map((j) => j.id === id ? { ...j, status: "closed" } : j));
      if (stats) setStats({ ...stats, activeJobs: Math.max(0, stats.activeJobs - 1) });
    } catch (e: any) { alert(e.message || "Erro ao fechar."); }
    finally { setClosingJob(null); }
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
            onClick={() => { setTab(t.key); setSearch(""); }}
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
                display: "grid", gridTemplateColumns: "44px 1fr 180px 120px 70px 80px 110px 44px",
                padding: "9px 16px", borderBottom: "1px solid var(--line)",
                fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", gap: 10, minWidth: 700,
              }}>
                <span></span><span>Nome</span><span>Email</span><span>Função</span>
                <span>Rating</span><span>Saldo</span><span>Criado</span><span></span>
              </div>

              {filteredUsers.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Nenhum utilizador encontrado.</div>
              )}

              {filteredUsers.map((u, i) => (
                <div key={u.id} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr 180px 120px 70px 80px 110px 44px",
                  padding: "11px 16px", alignItems: "center", gap: 10, minWidth: 700,
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
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>
              Mensagens <span style={{ color: "var(--muted)", fontWeight: 400 }}>({messages.length})</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.map((m) => (
                <div key={m.id} style={{
                  background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
                  padding: "12px 16px", display: "flex", gap: 14, alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                    background: m.messageType === "payment_escrow" || m.messageType === "payment_released"
                      ? "#22c55e" : m.messageType === "application" ? "#8b5cf6" : "var(--brand)",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                      <span style={{ color: "var(--brand)" }}>{m.fromName}</span>
                      <span style={{ color: "var(--muted)", margin: "0 6px" }}>→</span>
                      <span>{m.toName}</span>
                      {m.jobTitle && (
                        <span style={{
                          marginLeft: 8, fontSize: 11, padding: "1px 7px", borderRadius: 6,
                          background: "var(--surface2)", color: "var(--muted)",
                        }}>{m.jobTitle}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{m.content}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmt(m.createdAt)}</span>
                    {m.messageType !== "text" && (
                      <Badge
                        label={m.messageType === "payment_escrow" ? "Pagamento" : m.messageType === "payment_released" ? "Liberado" : m.messageType}
                        color="#22c55e"
                      />
                    )}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>Sem mensagens ainda.</div>
              )}
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
