import type { MatchRecord, Opportunity, User } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { Star, Briefcase, Award, Shield } from "lucide-react";

type DashboardPageProps = {
  allItems: Opportunity[];
  matches: MatchRecord[];
  onPost: () => void;
  t: (key: TranslationKey) => string;
  user: User;
};

export function DashboardPage({ allItems, matches, onPost, t, user }: DashboardPageProps) {
  const isEmployer = user.role === "employer";

  return (
    <section className="screen dashboard-screen">
      <div className="screen-head" style={{ marginBottom: "20px" }}>
        <div>
          <p className="eyebrow">Área de Trabalho FlexJob</p>
          <h2>
            {user.name.split(" ")[0]}, {isEmployer ? "hoje há profissionais disponíveis perto de si." : "hoje há trabalho à sua espera perto de si."}
          </h2>
        </div>
        <button className="primary" onClick={onPost}>
          {isEmployer ? "+ Publicar Vaga" : "Ver Vagas no Mapa"}
        </button>
      </div>

      <div className="dashboard-grid">
        <article style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <strong>{allItems.length}</strong>
          <span>{isEmployer ? "trabalhadores na área" : "vagas disponíveis na área"}</span>
        </article>
        <article style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <strong>{matches.length}</strong>
          <span>{isEmployer ? "tarefas criadas" : "tarefas candidatadas"}</span>
        </article>
        <article style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <strong>{isEmployer ? "EUR 0" : "EUR 48"}</strong>
          <span>{isEmployer ? "custo total em demo" : "ganhos estimados em demo"}</span>
        </article>
        <article style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {user.rating?.toFixed(1) ?? "5.0"}
            <Star size={24} fill="var(--yellow)" color="var(--yellow-dark)" style={{ display: "inline-block" }} />
          </strong>
          <span>A minha classificação</span>
        </article>
      </div>

      <div className="how-it-works" style={{ marginTop: "24px", padding: "24px" }}>
        <p className="eyebrow">{t("howWorks")}</p>
        <h3 style={{ fontSize: "1.6rem", fontWeight: "bold", marginBottom: "16px" }}>Do pedido ao pagamento seguro</h3>
        <div className="process-grid">
          <span style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
            <div style={{ display: "grid", width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255, 210, 51, 0.2)", placeItems: "center", color: "var(--yellow-dark)" }}>
              <strong>1</strong>
            </div>
            <strong>{isEmployer ? "Publicar Vaga" : "Ver no Mapa"}</strong>
            <small style={{ color: "var(--muted)" }}>
              {isEmployer ? "Selecione o local exato no mapa e defina o preço/hora da tarefa." : "Consulte as vagas na sua região e veja a distância e rating da empresa."}
            </small>
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
            <div style={{ display: "grid", width: "36px", height: "36px", borderRadius: "10px", background: "rgba(29, 139, 95, 0.2)", placeItems: "center", color: "var(--green)" }}>
              <strong>2</strong>
            </div>
            <strong>{isEmployer ? "Escolher Profissional" : "Candidatar-se"}</strong>
            <small style={{ color: "var(--muted)" }}>
              {isEmployer ? "Compare perfis de trabalhadores, o seu raio de ação e reputação real." : "Envie a candidatura num clique. O empreendedor recebe um alerta instantâneo."}
            </small>
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
            <div style={{ display: "grid", width: "36px", height: "36px", borderRadius: "10px", background: "rgba(45, 108, 223, 0.2)", placeItems: "center", color: "var(--blue)" }}>
              <strong>3</strong>
            </div>
            <strong>Executar & Confirmar</strong>
            <small style={{ color: "var(--muted)" }}>
              Realize a tarefa no local combinado. O empreendedor confirma a conclusão do trabalho na app.
            </small>
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
            <div style={{ display: "grid", width: "36px", height: "36px", borderRadius: "10px", background: "rgba(228, 87, 79, 0.2)", placeItems: "center", color: "var(--red)" }}>
              <strong>4</strong>
            </div>
            <strong>Avaliar & Receber</strong>
            <small style={{ color: "var(--muted)" }}>
              Ambas as partes avaliam a experiência. O saldo demo é atualizado de forma segura na carteira.
            </small>
          </span>
        </div>
      </div>
    </section>
  );
}
