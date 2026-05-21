import { type FormEvent, useState } from "react";
import { Globe2 } from "lucide-react";
import type { Language, User, UserRole } from "../types";
import type { TranslationKey } from "../i18n/translations";

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onLogin: (user: User) => void;
  t: (key: TranslationKey) => string;
};

import { api } from "../utils/api";

const REGIONS = [
  { name: "Lisboa", lat: 38.7223, lng: -9.1393 },
  { name: "Porto", lat: 41.1579, lng: -8.6291 },
  { name: "Coimbra", lat: 40.2033, lng: -8.4103 },
  { name: "Braga", lat: 41.5454, lng: -8.4265 },
  { name: "Faro (Algarve)", lat: 37.0179, lng: -7.9308 },
  { name: "Funchal (Madeira)", lat: 32.6500, lng: -16.9 },
  { name: "Ponta Delgada (Açores)", lat: 37.7412, lng: -25.6756 },
  { name: "Évora (Alentejo)", lat: 38.5714, lng: -7.9096 },
];

export function LandingPage({ language, onLanguageChange, onLogin, t }: LandingPageProps) {
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("Maria Santos");
  const [email, setEmail] = useState("maria@email.com");
  const [role, setRole] = useState<UserRole>("worker");
  const [region, setRegion] = useState("Lisboa");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
    }
  }

  return (
    <section className="landing-shell">
      <header className="landing-nav">
        <div className="brand">
          <span className="brand-mark">FJ</span>
          <span>FlexJob</span>
        </div>
        <button className="icon-button" onClick={() => onLanguageChange(language === "pt" ? "en" : "pt")}>
          <Globe2 size={18} />
          {language === "pt" ? "EN" : "PT"}
        </button>
      </header>

      <main className="landing-main">
        <section className="landing-copy">
          <p className="eyebrow">Portugal temporary marketplace</p>
          <h1>{t("heroTitle")}</h1>
          <p className="landing-text">{t("heroText")}</p>
          <div className="landing-actions">
            <button className="primary" onClick={() => setAuthMode("signup")}>{t("createAccount")}</button>
            <button className="secondary" onClick={() => setAuthMode("login")}>{t("login")}</button>
          </div>
          <div className="landing-points" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginTop: "2rem" }}>
            <span><strong style={{ fontSize: "1.3rem" }}>+5,000</strong><small style={{ display: "block", color: "rgba(255,255,255,0.7)" }}>Utilizadores em Portugal</small></span>
            <span><strong style={{ fontSize: "1.3rem" }}>100%</strong><small style={{ display: "block", color: "rgba(255,255,255,0.7)" }}>Geolocalizado no Mapa</small></span>
            <span><strong style={{ fontSize: "1.3rem" }}>7 min</strong><small style={{ display: "block", color: "rgba(255,255,255,0.7)" }}>Média para Match</small></span>
            <span><strong style={{ fontSize: "1.3rem" }}>4.9 ★</strong><small style={{ display: "block", color: "rgba(255,255,255,0.7)" }}>Satisfação Geral</small></span>
          </div>
        </section>

        <aside className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => setAuthMode("signup")}>{t("createAccount")}</button>
            <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>{t("login")}</button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {error && <div className="error-message" style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
            {authMode === "signup" && (
              <>
                <label className="form-row">
                  <span>{t("name")}</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label className="form-row">
                  <span>Região de Portugal</span>
                  <select value={region} onChange={(event) => setRegion(event.target.value)} style={{ padding: "0.5rem", borderRadius: "4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                    {REGIONS.map((r) => (
                      <option key={r.name} value={r.name} style={{ background: "#2e2e2e" }}>{r.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="form-row">
              <span>{t("email")}</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="form-row">
              <span>{t("password")}</span>
              <input type="password" defaultValue="123456" disabled />
            </label>
            {authMode === "signup" && (
              <div className="role-grid" style={{ margin: "1rem 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#fff", cursor: "pointer" }}>
                  <input checked={role === "worker"} onChange={() => setRole("worker")} type="radio" /> Trabalhador
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#fff", cursor: "pointer" }}>
                  <input checked={role === "employer"} onChange={() => setRole("employer")} type="radio" /> Empreendedor / Precisa de ajuda
                </label>
              </div>
            )}
            <button className="primary full" type="submit">{t("enterApp")}</button>
            <p className="auth-note">{t("localDemo")}</p>
          </form>
        </aside>
      </main>

      <section className="how-it-works-section" style={{ marginTop: "4rem", padding: "3rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", borderRadius: "16px" }}>
        <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "2.5rem", color: "#fff", fontWeight: "600" }}>Como funciona a FlexJob?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2rem" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "1.75rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)", transition: "transform 0.2s" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#6366f1", marginBottom: "0.75rem" }}>01. Registo Rápido</div>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.5" }}>Escolha o seu perfil (Trabalhador ou Empreendedor), selecione a sua região e comece a interagir instantaneamente.</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "1.75rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)", transition: "transform 0.2s" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#6366f1", marginBottom: "0.75rem" }}>02. Mapa Interativo</div>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.5" }}>Indique a morada exata do trabalho e localizaremos no mapa. Trabalhadores ativos encontram as vagas próximas com facilidade.</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "1.75rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)", transition: "transform 0.2s" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#6366f1", marginBottom: "0.75rem" }}>03. Chat Livre em Tempo Real</div>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.5" }}>Comunique diretamente por mensagens instantâneas. Faça upload de fotos, tire dúvidas e acerte detalhes operacionais.</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "1.75rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(10px)", transition: "transform 0.2s" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#6366f1", marginBottom: "0.75rem" }}>04. Reputação & Ganhos</div>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.5" }}>Finalize tarefas através da aplicação, receba na carteira digital e acumule avaliações positivas para subir no ranking.</p>
          </div>
        </div>
      </section>
    </section>
  );
}
