import { type FormEvent, useState } from "react";
import { Globe2 } from "lucide-react";
import type { Language, User, UserRole } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { api } from "../utils/api";

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onLogin: (user: User) => void;
  t: (key: TranslationKey) => string;
};

const REGIONS = [
  { name: "Lisboa",                  lat: 38.7223, lng: -9.1393  },
  { name: "Porto",                   lat: 41.1579, lng: -8.6291  },
  { name: "Coimbra",                 lat: 40.2033, lng: -8.4103  },
  { name: "Braga",                   lat: 41.5454, lng: -8.4265  },
  { name: "Faro (Algarve)",          lat: 37.0179, lng: -7.9308  },
  { name: "Funchal (Madeira)",       lat: 32.6500, lng: -16.9    },
  { name: "Ponta Delgada (Açores)", lat: 37.7412, lng: -25.6756 },
  { name: "Évora (Alentejo)",        lat: 38.5714, lng: -7.9096  },
];


export function LandingPage({ language, onLanguageChange, onLogin, t }: LandingPageProps) {
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [name, setName]         = useState("Maria Santos");
  const [email, setEmail]       = useState("maria@email.com");
  const [role, setRole]         = useState<UserRole>("worker");
  const [region, setRegion]     = useState("Lisboa");
  const [bio, setBio]           = useState("");
  const [hourlyRate, setHourlyRate] = useState(10);
  const [password, setPassword] = useState("123456");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (authMode === "signup") {
        const selectedRegion = REGIONS.find((r) => r.name === region) || REGIONS[0];
        await api.register(name, email, role, selectedRegion.lat, selectedRegion.lng, bio, role === "worker" ? hourlyRate : 0);
        const loggedInUser = await api.login(email);
        onLogin(loggedInUser);
      } else {
        const loggedInUser = await api.login(email);
        onLogin(loggedInUser);
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro. Verifique os seus dados.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="landing-shell">
      {/* Nav */}
      <header className="landing-nav">
        <div className="brand">
          <span className="brand-mark">FJ</span>
          <span>FlexJob</span>
        </div>
        <button className="icon-button" onClick={() => onLanguageChange(language === "pt" ? "en" : "pt")}>
          <Globe2 size={16} />
          {language === "pt" ? "EN" : "PT"}
        </button>
      </header>

      {/* Hero + auth */}
      <main className="landing-main">
        {/* Copy */}
        <section className="landing-copy">
          <p className="eyebrow">Portugal · Trabalho temporário</p>
          <h1>{t("heroTitle")}</h1>
          <p className="landing-text">{t("heroText")}</p>

          <div className="landing-actions">
            <button className="primary" onClick={() => setAuthMode("signup")}>{t("createAccount")}</button>
            <button className="secondary" onClick={() => setAuthMode("login")}>{t("login")}</button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginTop: "2rem", maxWidth: "400px" }}>
            {[
              { value: "+5.000", label: "Utilizadores em Portugal" },
              { value: "100%",   label: "Geolocalizado no Mapa" },
              { value: "7 min",  label: "Média para Match" },
              { value: "4.9 ★",  label: "Satisfação Geral" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "1rem", border: "1px solid var(--line)", borderRadius: "14px", background: "var(--surface2)" }}>
                <strong style={{ fontSize: "1.3rem", display: "block", color: "var(--ink)" }}>{s.value}</strong>
                <small style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{s.label}</small>
              </div>
            ))}
          </div>
        </section>

        {/* Auth card */}
        <aside className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => setAuthMode("signup")}>
              {t("createAccount")}
            </button>
            <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>
              {t("login")}
            </button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {error && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: "10px", background: "rgba(240,96,96,0.12)", border: "1px solid rgba(240,96,96,0.3)", color: "#f06060", fontSize: "0.85rem" }}>
                {error}
              </div>
            )}

            {authMode === "signup" && (
              <>
                <label className="form-row">
                  <span>{t("name")}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="O seu nome completo" />
                </label>
                <label className="form-row">
                  <span>Região de Portugal</span>
                  <select value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map((r) => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className="form-row">
              <span>{t("email")}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@exemplo.com" />
            </label>

            <label className="form-row">
              <span>{t("password")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="123456" />
            </label>

            {authMode === "signup" && (
              <>
                <div className="role-grid" style={{ margin: "0.5rem 0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="radio" checked={role === "worker"} onChange={() => setRole("worker")} style={{ accentColor: "#ffd233" }} />
                    💼 Trabalhador
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="radio" checked={role === "employer"} onChange={() => setRole("employer")} style={{ accentColor: "#ffd233" }} />
                    🏢 Empreendedor
                  </label>
                </div>
                <label className="form-row">
                  <span>{role === "worker" ? "Sobre mim / Bio" : "Descrição da empresa"}</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={role === "worker" ? "Ex: Experiente em restauração e eventos, disponível imediatamente..." : "Ex: Café familiar no centro de Lisboa, procuramos profissionais de atendimento..."}
                    rows={2}
                    style={{ resize: "vertical", fontFamily: "inherit", fontSize: "0.9rem" }}
                  />
                </label>
                {role === "worker" && (
                  <label className="form-row">
                    <span>Taxa horária (€/h)</span>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      step={0.5}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 10)}
                    />
                  </label>
                )}
              </>
            )}

            <button className="primary full" type="submit" disabled={loading}>
              {loading ? "A entrar..." : t("enterApp")}
            </button>
            <p className="auth-note" style={{ textAlign: "center", marginTop: "0.25rem" }}>{t("localDemo")}</p>

            {/* Demo accounts */}
            <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "rgba(255,210,51,0.07)", border: "1px solid rgba(255,210,51,0.2)", borderRadius: "10px" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.7rem", fontWeight: "700", color: "var(--yellow-dark)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Contas de demonstração (senha: 123456)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                {[
                  { label: "💼 Trabalhadora", email: "ines@email.com" },
                  { label: "🏢 Empregador",   email: "cafeaurora@email.com" },
                  { label: "🛡️ Admin",        email: "admin@flexjob.com" },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword("123456"); setAuthMode("login"); }}
                    style={{ padding: "0.45rem 0.6rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.75rem", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                  >
                    <strong style={{ display: "block", fontSize: "0.78rem" }}>{acc.label}</strong>
                    <small style={{ color: "var(--muted)" }}>{acc.email}</small>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </aside>
      </main>

    </section>
  );
}
