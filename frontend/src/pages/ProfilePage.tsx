import { Star, MapPin, Briefcase, User, Clock, Shield } from "lucide-react";
import type { User as UserType } from "../types";
import type { TranslationKey } from "../i18n/translations";

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

  const roleLabel  = isWorker ? "Trabalhador" : "Empreendedor";
  const roleColor  = isWorker ? "#10b981" : "#f59e0b";
  const roleBg     = isWorker ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)";
  const roleBorder = isWorker ? "rgba(16,185,129,0.3)"  : "rgba(245,158,11,0.3)";

  return (
    <section style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>

      {/* Profile card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.08))",
        border: "1px solid rgba(99,102,241,0.2)",
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
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "700", color: "#fff" }}>{user.name}</h2>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", padding: "0.2rem 0.6rem", borderRadius: "8px", background: roleBg, color: roleColor, border: `1px solid ${roleBorder}` }}>
              {roleLabel}
            </span>
          </div>
          <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>{user.email}</p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.83rem" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
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
              { icon: <Briefcase size={18} />, label: "Tarefas concluídas", value: "24" },
              { icon: <Clock size={18} />,     label: "Taxa de presença",    value: "98%" },
              { icon: <Star size={18} />,      label: "Preço base",         value: "€11/h" },
            ]
          : [
              { icon: <Briefcase size={18} />, label: "Vagas publicadas",   value: "8" },
              { icon: <User size={18} />,      label: "Trabalhadores contratados", value: "31" },
              { icon: <Star size={18} />,      label: "Avaliação dada",     value: "4.7 ★" },
            ]
        ).map((stat) => (
          <div
            key={stat.label}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "1.1rem", textAlign: "center" }}
          >
            <div style={{ color: "#6366f1", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>{stat.icon}</div>
            <strong style={{ fontSize: "1.3rem", color: "#fff", display: "block" }}>{stat.value}</strong>
            <small style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", display: "block", marginTop: "0.2rem" }}>{stat.label}</small>
          </div>
        ))}
      </div>

      {/* Details section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        {isWorker ? (
          <>
            <InfoCard title="Competências" icon={<Briefcase size={15} />}>
              Eventos, restauração, logística e retalho.
            </InfoCard>
            <InfoCard title="Disponibilidade" icon={<Clock size={15} />}>
              Disponível para trabalhos de curta duração (dia ou semana) em {region}. Raio de ação: 10 km.
            </InfoCard>
          </>
        ) : (
          <>
            <InfoCard title="Sobre a empresa / perfil" icon={<User size={15} />}>
              {user.bio ?? `Empreendedor registado em ${region}. Utiliza a FlexJob para encontrar trabalhadores disponíveis de forma rápida e fiável.`}
            </InfoCard>
            <InfoCard title="Região de atuação" icon={<MapPin size={15} />}>
              {region} · Publica vagas para trabalhos de curta duração, eventos e apoio pontual.
            </InfoCard>
          </>
        )}
      </div>

      {/* Trust checklist */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Shield size={16} style={{ color: "#6366f1" }} />
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "700", color: "#fff" }}>Checklist de Confiança</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            { label: "Identidade verificada",   done: true },
            { label: "Conta criada na FlexJob", done: true },
            { label: "Pagamentos protegidos",   done: true },
            { label: "Avaliações mútuas",       done: true },
            { label: "Recibos / faturas",       done: false },
            { label: "Seguro de acidentes",     done: false },
          ].map((item) => (
            <label key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "default" }}>
              <span style={{
                width: "18px", height: "18px", borderRadius: "5px", flexShrink: 0,
                background: item.done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)",
                border: item.done ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: item.done ? "#10b981" : "rgba(255,255,255,0.2)",
                fontSize: "0.7rem",
              }}>
                {item.done ? "✓" : ""}
              </span>
              <span style={{ fontSize: "0.85rem", color: item.done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)" }}>
                {item.label}
                {!item.done && <span style={{ fontSize: "0.72rem", marginLeft: "0.4rem", color: "rgba(255,255,255,0.25)" }}>(em breve)</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "1.1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
        <span style={{ color: "#6366f1" }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.4)" }}>{title}</h4>
      </div>
      <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(255,255,255,0.75)", lineHeight: "1.55" }}>{children}</p>
    </div>
  );
}
