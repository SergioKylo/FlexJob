import { useEffect, useRef, useState } from "react";
import { Star, MapPin, Briefcase, User, Clock, CreditCard, Edit2, X, Check, Camera } from "lucide-react";
import type { User as UserType } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { api } from "../utils/api";

type ProfilePageProps = {
  t: (key: TranslationKey) => string;
  user: UserType;
  onUserUpdate?: (updated: Partial<UserType>) => void;
};

const REGIONS = [
  { name: "Lisboa",                lat: 38.7223, lng: -9.1393 },
  { name: "Porto",                 lat: 41.1579, lng: -8.6291 },
  { name: "Coimbra",               lat: 40.2033, lng: -8.4103 },
  { name: "Braga",                 lat: 41.5454, lng: -8.4265 },
  { name: "Faro (Algarve)",        lat: 37.0179, lng: -7.9308 },
  { name: "Funchal (Madeira)",     lat: 32.6500, lng: -16.9   },
  { name: "Ponta Delgada (Açores)",lat: 37.7412, lng: -25.6756},
  { name: "Évora (Alentejo)",      lat: 38.5714, lng: -7.9096 },
];

function nearestRegion(lat?: number, lng?: number): string {
  if (!lat || !lng) return "Portugal";
  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(r.lat - lat, r.lng - lng);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best.name;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  open:      { label: "Aberta",    color: "#22c97a", bg: "rgba(34,201,122,0.1)"  },
  accepted:  { label: "Em curso",  color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
  completed: { label: "Concluída", color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  closed:    { label: "Fechada",   color: "var(--muted)", bg: "var(--surface2)" },
};

type EditJobForm = {
  title: string;
  description: string;
  pay: number;
  duration: string;
  workDate: string;
  address: string;
};

export function ProfilePage({ user, onUserUpdate }: ProfilePageProps) {
  const isWorker = user.role === "worker";
  const region = nearestRegion(user.lat, user.lng);
  const rating = user.rating ?? 5.0;

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarSrc, setAvatarSrc] = useState<string>(user.avatar ?? "");
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Sync avatar if user prop changes (e.g. after onUserUpdate propagates back)
  useEffect(() => {
    if (user.avatar) setAvatarSrc(user.avatar);
  }, [user.avatar]);

  // Region
  const [editRegion, setEditRegion] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [savingRegion, setSavingRegion] = useState(false);
  const [regionSaved, setRegionSaved] = useState(false);

  // Employer jobs
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editJobForm, setEditJobForm] = useState<EditJobForm>({ title: "", description: "", pay: 0, duration: "", workDate: "", address: "" });
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    if (!isWorker) {
      api.getMyJobs().then(setMyJobs).catch(() => {});
    }
  }, [isWorker]);

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setAvatarSrc(base64);
      setSavingAvatar(true);
      try {
        const result = await api.updateProfile(user.name, user.bio ?? "", base64);
        onUserUpdate?.({ avatar: result.avatar });
      } catch {
        alert("Erro ao guardar avatar.");
      } finally {
        setSavingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveRegion() {
    const r = REGIONS.find((x) => x.name === selectedRegion) ?? REGIONS[0];
    setSavingRegion(true);
    try {
      await api.updateAvailability({ lat: r.lat, lng: r.lng, radius: 10, startTime: "09:00", endTime: "18:00", hourlyRate: 10, isActive: true });
      setRegionSaved(true);
      setEditRegion(false);
      setTimeout(() => setRegionSaved(false), 3000);
    } catch {
      alert("Erro ao guardar região.");
    } finally {
      setSavingRegion(false);
    }
  }

  async function handleCloseJob(jobId: number) {
    setClosingId(jobId);
    try {
      await api.closeJob(jobId);
      setMyJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "closed" } : j));
    } catch {
      alert("Erro ao fechar vaga.");
    } finally {
      setClosingId(null);
    }
  }

  function startEditJob(job: any) {
    setEditingJobId(job.id);
    setEditJobForm({
      title: job.title ?? "",
      description: job.description ?? "",
      pay: job.pay ?? 0,
      duration: job.duration ?? "",
      workDate: job.workDate ?? "",
      address: job.address ?? "",
    });
  }

  async function handleSaveJob(jobId: number) {
    setSavingJob(true);
    try {
      await api.updateJob({ jobId, ...editJobForm });
      setMyJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, ...editJobForm } : j));
      setEditingJobId(null);
    } catch (err: any) {
      alert(err.message || "Erro ao guardar vaga.");
    } finally {
      setSavingJob(false);
    }
  }

  const roleLabel  = isWorker ? "Trabalhador" : "Empreendedor";
  const roleColor  = isWorker ? "#10b981" : "#f59e0b";
  const roleBg     = isWorker ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)";
  const roleBorder = isWorker ? "rgba(16,185,129,0.3)"  : "rgba(245,158,11,0.3)";

  const activeJobs = myJobs.filter((j) => j.status === "open" || j.status === "accepted");
  const pastJobs   = myJobs.filter((j) => j.status === "completed" || j.status === "closed");

  return (
    <section style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>

      {/* Profile card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(79,70,229,0.06))",
        border: "1px solid var(--line)", borderRadius: "20px", padding: "2rem",
        marginBottom: "1.5rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap",
      }}>
        {/* Avatar with upload overlay */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", fontWeight: "800", color: "#fff",
            border: "3px solid rgba(99,102,241,0.4)",
            overflow: "hidden",
          }}>
            {avatarSrc ? (
              <img src={avatarSrc} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          {/* Camera overlay button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={savingAvatar}
            title="Alterar avatar"
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: "26px", height: "26px", borderRadius: "50%",
              background: "#6366f1", border: "2px solid var(--bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
              opacity: savingAvatar ? 0.5 : 1,
            }}
          >
            <Camera size={12} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarFileChange}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "700", color: "var(--ink)" }}>{user.name}</h2>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", padding: "0.2rem 0.6rem", borderRadius: "8px", background: roleBg, color: roleColor, border: `1px solid ${roleBorder}` }}>
              {roleLabel}
            </span>
          </div>
          <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "var(--muted)" }}>{user.email}</p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.83rem" }}>
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <MapPin size={13} style={{ color: "#6366f1" }} />
              {region}
            </span>
            <span style={{ color: "#facc15", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Star size={13} fill="#facc15" />
              {rating.toFixed(1)} avaliação média
            </span>
          </div>
          {savingAvatar && <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: "#6366f1" }}>A guardar avatar...</p>}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {(isWorker
          ? [
              { icon: <Briefcase size={18} />, label: "Tarefas concluídas", value: "–" },
              { icon: <Clock size={18} />,     label: "Raio de ação",       value: "10 km" },
              { icon: <CreditCard size={18} />,label: "Taxa de serviço",    value: "€0/h" },
            ]
          : [
              { icon: <Briefcase size={18} />, label: "Vagas publicadas",  value: String(myJobs.length || "–") },
              { icon: <User size={18} />,      label: "Vagas ativas",      value: String(activeJobs.length || "–") },
              { icon: <Star size={18} />,      label: "Avaliação média",   value: `${rating.toFixed(1)} ★` },
            ]
        ).map((stat) => (
          <div key={stat.label} style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "14px", padding: "1.1rem", textAlign: "center" }}>
            <div style={{ color: "#6366f1", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>{stat.icon}</div>
            <strong style={{ fontSize: "1.3rem", color: "var(--ink)", display: "block" }}>{stat.value}</strong>
            <small style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginTop: "0.2rem" }}>{stat.label}</small>
          </div>
        ))}
      </div>

      {/* Details section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <InfoCard title={isWorker ? "Sobre mim" : "Sobre a empresa"} icon={<User size={15} />}>
          {user.bio && user.bio.trim()
            ? user.bio
            : isWorker
              ? "Sem bio definida."
              : `Empreendedor registado em ${region}.`
          }
        </InfoCard>

        {isWorker ? (
          <>
            <InfoCard title="Disponibilidade" icon={<Clock size={15} />}>
              Disponível para trabalhos de curta duração. Raio de ação: 10 km a partir de {region}.
            </InfoCard>

            {/* Change region */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "1.1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editRegion ? "0.75rem" : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <MapPin size={15} style={{ color: "#6366f1" }} />
                  <h4 style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Região de trabalho</h4>
                </div>
                <button onClick={() => setEditRegion((v) => !v)}
                  style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: "0.78rem", fontWeight: "600" }}>
                  <Edit2 size={12} />
                  {editRegion ? "Cancelar" : "Mudar região"}
                </button>
              </div>
              {!editRegion && (
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink)", lineHeight: "1.55" }}>{region} · Raio de ação: 10 km</p>
              )}
              {editRegion && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}
                    style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.9rem" }}>
                    {REGIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                  <button onClick={handleSaveRegion} disabled={savingRegion}
                    style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", opacity: savingRegion ? 0.6 : 1 }}>
                    {savingRegion ? "A guardar..." : "Guardar região"}
                  </button>
                  {regionSaved && <p style={{ margin: 0, fontSize: "0.78rem", color: "#22c97a", fontWeight: "600" }}>✓ Região atualizada!</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <InfoCard title="Região de atuação" icon={<MapPin size={15} />}>
              {region} · Publica vagas para trabalhos de curta duração, eventos e apoio pontual.
            </InfoCard>

            {/* Employer jobs */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "1.1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
                <Briefcase size={15} style={{ color: "#6366f1" }} />
                <h4 style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>
                  Vagas Ativas ({activeJobs.length})
                </h4>
              </div>

              {myJobs.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>Ainda não publicou nenhuma vaga.</p>
              ) : activeJobs.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>Sem vagas ativas de momento.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {activeJobs.map((job) => {
                    const st = STATUS_LABELS[job.status] ?? STATUS_LABELS.open;
                    const isEditing = editingJobId === job.id;
                    return (
                      <div key={job.id} style={{ borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", overflow: "hidden" }}>
                        {/* Job header row */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 0.9rem" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.15rem" }}>
                              <span style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {job.title}
                              </span>
                              <span style={{ fontSize: "0.68rem", fontWeight: "700", padding: "0.15rem 0.5rem", borderRadius: "6px", background: st.bg, color: st.color, flexShrink: 0 }}>
                                {st.label}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                              <span>€{job.pay}/h</span>
                              {job.workDate && <span>📅 {job.workDate}</span>}
                              {job.applicationsCount > 0 && <span>👥 {job.applicationsCount} candidatura{job.applicationsCount !== 1 ? "s" : ""}</span>}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                            {job.status === "open" && (
                              <button
                                onClick={() => isEditing ? setEditingJobId(null) : startEditJob(job)}
                                style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.6rem", borderRadius: "7px", border: "1px solid var(--line)", background: isEditing ? "var(--surface)" : "var(--surface)", color: "#6366f1", fontSize: "0.73rem", fontWeight: "700", cursor: "pointer" }}
                              >
                                <Edit2 size={11} />
                                {isEditing ? "Cancelar" : "Editar"}
                              </button>
                            )}
                            {job.status === "open" && (
                              <button
                                onClick={() => handleCloseJob(job.id)}
                                disabled={closingId === job.id}
                                style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.6rem", borderRadius: "7px", border: "1px solid rgba(240,96,96,0.35)", background: "rgba(240,96,96,0.08)", color: "#f06060", fontSize: "0.73rem", fontWeight: "700", cursor: "pointer", opacity: closingId === job.id ? 0.5 : 1 }}
                              >
                                <X size={11} />
                                Fechar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {isEditing && (
                          <div style={{ padding: "0.75rem 0.9rem", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "0.55rem", background: "var(--surface)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.4rem" }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Título</span>
                                <input value={editJobForm.title} onChange={(e) => setEditJobForm((f) => ({ ...f, title: e.target.value }))}
                                  style={{ padding: "0.45rem 0.65rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Descrição</span>
                                <textarea value={editJobForm.description} onChange={(e) => setEditJobForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                                  style={{ padding: "0.45rem 0.65rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.85rem", resize: "vertical", fontFamily: "inherit" }} />
                              </label>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>€/h</span>
                                <input type="number" min={5} value={editJobForm.pay} onChange={(e) => setEditJobForm((f) => ({ ...f, pay: parseFloat(e.target.value) || 0 }))}
                                  style={{ padding: "0.45rem 0.65rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Duração</span>
                                <input value={editJobForm.duration} onChange={(e) => setEditJobForm((f) => ({ ...f, duration: e.target.value }))}
                                  style={{ padding: "0.45rem 0.65rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Dia</span>
                                <input type="date" value={editJobForm.workDate} onChange={(e) => setEditJobForm((f) => ({ ...f, workDate: e.target.value }))}
                                  style={{ padding: "0.45rem 0.65rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.85rem" }} />
                              </label>
                            </div>
                            <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                              <span style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Morada</span>
                              <input value={editJobForm.address} onChange={(e) => setEditJobForm((f) => ({ ...f, address: e.target.value }))}
                                style={{ padding: "0.45rem 0.65rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }} />
                            </label>
                            <button onClick={() => handleSaveJob(job.id)} disabled={savingJob}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.5rem", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", opacity: savingJob ? 0.6 : 1 }}>
                              <Check size={14} />
                              {savingJob ? "A guardar..." : "Guardar alterações"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Past jobs */}
              {pastJobs.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: "1rem 0 0.6rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>
                      Histórico ({pastJobs.length})
                    </h4>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {pastJobs.map((job) => {
                      const st = STATUS_LABELS[job.status] ?? STATUS_LABELS.closed;
                      return (
                        <div key={job.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.55rem 0.9rem", borderRadius: "10px", background: "var(--surface2)", border: "1px solid var(--line)", opacity: 0.7 }}>
                          <span style={{ flex: 1, fontSize: "0.83rem", fontWeight: "600", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {job.title}
                          </span>
                          <span style={{ fontSize: "0.68rem", fontWeight: "700", padding: "0.15rem 0.5rem", borderRadius: "6px", background: st.bg, color: st.color, flexShrink: 0 }}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "1.1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
        <span style={{ color: "#6366f1" }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>{title}</h4>
      </div>
      <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink)", lineHeight: "1.55" }}>{children}</p>
    </div>
  );
}
