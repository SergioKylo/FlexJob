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

const HOW_IT_WORKS = [
  { step: "01", title: "Registo Rápido", desc: "Escolha o seu perfil (Trabalhador ou Empreendedor), selecione a sua região e comece a interagir instantaneamente.", accent: "#ffd233" },
  { step: "02", title: "Mapa Interativo", desc: "Indique a morada exata do trabalho e localizaremos no mapa. Trabalhadores ativos encontram vagas próximas com facilidade.", accent: "#22c97a" },
  { step: "03", title: "Chat em Tempo Real", desc: "Comunique diretamente por mensagens instantâneas. Tire dúvidas e acerte detalhes operacionais antes de começar.", accent: "#4a90e2" },
  { step: "04", title: "Reputação & Ganhos", desc: "Finalize tarefas pela aplicação, receba na carteira digital e acumule avaliações positivas para subir no ranking.", accent: "#f06060" },
];

export function LandingPage({ language, onLanguageChange, onLogin, t }: LandingPageProps) {
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [name, setName]         = useState("Maria Santos");
  const [email, setEmail]       = useState("maria@email.com");
  const [role, setRole]         = useState<UserRole>("worker");
  const [region, setRegion]     = useState("Lisboa");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (authMode === "signup") {
        const selectedRegion = REGIONS.find((r) => r.name === region) || REGIONS[0];
        await api.register(name, email, role, selectedRegion.lat, selectedRegion.lng);
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
              <div key={s.label} style={{ padding: "1rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", background: "rgba(255,255,255,0.04)" }}>
                <strong style={{ fontSize: "1.3rem", display: "block", color: "#f0f0ed" }}>{s.value}</strong>
                <small style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem" }}>{s.label}</small>
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
              <input type="password" defaultValue="123456" disabled style={{ opacity: 0.5 }} />
            </label>

            {authMode === "signup" && (
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
            )}

            <button className="primary full" type="submit" disabled={loading}>
              {loading ? "A entrar..." : t("enterApp")}
            </button>
            <p className="auth-note" style={{ textAlign: "center", marginTop: "0.25rem" }}>{t("localDemo")}</p>
          </form>
        </aside>
      </main>

      {/* How it works */}
      <section style={{ padding: "3rem clamp(16px, 5vw, 48px) 4rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Como funciona</p>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: "700" }}>FlexJob em 4 passos simples</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", maxWidth: "1100px", margin: "0 auto" }}>
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              style={{ padding: "1.5rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", position: "relative", overflow: "hidden" }}
            >
              <div style={{ fontSize: "2.5rem", fontWeight: "900", color: item.accent, opacity: 0.15, position: "absolute", top: "0.5rem", right: "0.75rem", lineHeight: 1 }}>
                {item.step}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: "800", color: item.accent, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                {item.step}
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#f0f0ed", marginBottom: "0.6rem" }}>{item.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", lineHeight: "1.55", margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
