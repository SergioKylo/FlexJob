import type { User } from "../types";
import type { TranslationKey } from "../i18n/translations";

type ProfilePageProps = {
  t: (key: TranslationKey) => string;
  user: User;
};

export function ProfilePage({ t, user }: ProfilePageProps) {
  return (
    <section className="screen profile-screen">
      <div className="profile-card">
        <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
        <div>
          <p className="eyebrow">Perfil demo</p>
          <h2>{user.name}</h2>
          <p>Disponivel hoje em Lisboa. Prefere eventos, cafes e apoio logistico.</p>
        </div>
        <div className="trust-score"><strong>4.9</strong><span>{t("avgRating")}</span></div>
      </div>

      <div className="history-grid">
        <article><strong>24</strong><span>tarefas concluidas</span></article>
        <article><strong>98%</strong><span>taxa de presenca</span></article>
        <article><strong>EUR 11</strong><span>preco base/h</span></article>
      </div>

      <div className="profile-details">
        <article><h3>{t("skills")}</h3><p>Eventos, restauracao, logistica e retalho.</p></article>
        <article><h3>{t("availability")}</h3><p>Hoje das 14:00 as 22:00 em Lisboa, raio de 6 km.</p></article>
        <article><h3>{t("documents")}</h3><p>Identidade verificada em demo. Seguro e recibos ficam para fase futura.</p></article>
      </div>

      <div className="safety-checklist">
        <h3>{t("trust")}</h3>
        <label><input type="checkbox" checked readOnly /> Identidade verificada</label>
        <label><input type="checkbox" checked readOnly /> Pagamentos protegidos</label>
        <label><input type="checkbox" checked readOnly /> Avaliacoes mutuas</label>
        <label><input type="checkbox" readOnly /> Recibos/faturas numa fase futura</label>
      </div>
    </section>
  );
}
