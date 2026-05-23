import { useState } from "react";
import { Star, MapPin, Briefcase, User, Clock, CheckCircle, CreditCard, Edit2 } from "lucide-react";
import type { User as UserType } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { api } from "../utils/api";

type ProfilePageProps = {
  t: (key: TranslationKey) => string;
  user: UserType;
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

export function ProfilePage({ user }: ProfilePageProps) {
  const isWorker = user.role === "worker";
  const region = nearestRegion(user.lat, user.lng);
  const rating = user.rating ?? 5.0;

  const [editRegion, setEditRegion] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [savingRegion, setSavingRegion] = useState(false);
  const [regionSaved, setRegionSaved] = useState(false);

  async function handleSaveRegion() {
    const r = REGIONS.find((x) => x.name === selectedRegion) ?? REGIONS[0];
    setSavingRegion(true);
    try {
      await api.updateAvailability({
        lat: r.lat, lng: r.lng,
        radius: 10,
        startTime: "09:00", endTime: "18:00",
        hourlyRate: 10, isActive: true,
      });
      setRegionSaved(true);
      setEditRegion(false);
      setTimeout(() => setRegionSaved(false), 3000);
    } catch {
      alert("Erro ao guardar região. Tente novamente.");
    } finally {
      setSavingRegion(false);
    }
  }

  const roleLabel  = isWorker ? "Trabalhador" : "Empreendedor";
  const roleColor  = isWorker ? "#10b981" : "#f59e0b";
  const roleBg     = isWorker ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)";
  const roleBorder = isWorker ? "rgba(16,185,129,0.3)"  : "rgba(245,158,11,0.3)";

  return (
    <section style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>

      {/* Profile card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(79,70,229,0.06))",
        border: "1px solid var(--line)",
        borderRadius: "20px",
        padding: "2rem",
        marginBottom: "1.5rem",
        display: "flex",
        gap: "1.5rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        {/* Avatar */}
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "2rem", fontWeight: "800", color: "#fff",
          border: "3px solid rgba(99,102,241,0.4)", flexShrink: 0,
        }}>
          {user.name.charAt(0).toUpperCase()}
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
              { icon: <Briefcase size={18} />, label: "Vagas publicadas",         value: "–" },
              { icon: <User size={18} />,      label: "Trabalhadores contratados", value: "–" },
              { icon: <Star size={18} />,      label: "Avaliação dada",           value: `${rating.toFixed(1)} ★` },
            ]
        ).map((stat) => (
          <div
            key={stat.label}
            style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "14px", padding: "1.1rem", textAlign: "center" }}
          >
            <div style={{ color: "#6366f1", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>{stat.icon}</div>
            <strong style={{ fontSize: "1.3rem", color: "var(--ink)", display: "block" }}>{stat.value}</strong>
            <small style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginTop: "0.2rem" }}>{stat.label}</small>
          </div>
        ))}
      </div>

      {/* Details section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Bio / About */}
        <InfoCard title={isWorker ? "Sobre mim" : "Sobre a empresa"} icon={<User size={15} />}>
          {user.bio && user.bio.trim()
            ? user.bio
            : isWorker
              ? "Sem bio definida. Edite o seu perfil para adicionar uma descrição."
              : `Empreendedor registado em ${region}. Utilize a FlexJob para encontrar trabalhadores disponíveis de forma rápida.`
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
                <button
                  onClick={() => setEditRegion((v) => !v)}
                  style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: "0.78rem", fontWeight: "600" }}
                >
                  <Edit2 size={12} />
                  {editRegion ? "Cancelar" : "Mudar região"}
                </button>
              </div>
              {!editRegion && (
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink)", lineHeight: "1.55" }}>
                  {region} · Raio de ação: 10 km
                </p>
              )}
              {editRegion && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.9rem" }}
                  >
                    {REGIONS.map((r) => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveRegion}
                    disabled={savingRegion}
                    style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "0.85rem", opacity: savingRegion ? 0.6 : 1 }}
                  >
                    {savingRegion ? "A guardar..." : "Guardar região"}
                  </button>
                  {regionSaved && <p style={{ margin: 0, fontSize: "0.78rem", color: "#22c97a", fontWeight: "600" }}>✓ Região atualizada com sucesso!</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <InfoCard title="Região de atuação" icon={<MapPin size={15} />}>
            {region} · Publica vagas para trabalhos de curta duração, eventos e apoio pontual.
          </InfoCard>
        )}
      </div>

      {/* Account status */}
      <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "14px", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <CheckCircle size={16} style={{ color: "#22c97a" }} />
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "700", color: "var(--ink)" }}>Estado da Conta</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            { label: "Conta ativa na FlexJob",     done: true,  note: null },
            { label: "Pagamentos com garantia",     done: true,  note: "O dinheiro fica retido até confirmação" },
            { label: "Avaliações em tempo real",    done: true,  note: null },
            { label: "Perfil público",              done: !!(user.bio && user.bio.trim()), note: user.bio?.trim() ? null : "Adicione uma bio para se destacar" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
              <span style={{
                width: "18px", height: "18px", borderRadius: "5px", flexShrink: 0, marginTop: "1px",
                background: item.done ? "rgba(34,201,122,0.15)" : "var(--surface)",
                border: item.done ? "1px solid rgba(34,201,122,0.35)" : "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: item.done ? "#22c97a" : "var(--muted)",
                fontSize: "0.7rem",
              }}>
                {item.done ? "✓" : "○"}
              </span>
              <div>
                <span style={{ fontSize: "0.85rem", color: item.done ? "var(--ink)" : "var(--muted)", fontWeight: item.done ? "500" : "400" }}>
                  {item.label}
                </span>
                {item.note && (
                  <p style={{ margin: "0.1rem 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>{item.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
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
