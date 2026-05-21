import type { TranslationKey } from "../i18n/translations";

type WalletPageProps = {
  t: (key: TranslationKey) => string;
};

export function WalletPage({ t }: WalletPageProps) {
  return (
    <section className="screen wallet-screen">
      <div className="screen-head">
        <div>
          <p className="eyebrow">Demo wallet</p>
          <h2>{t("walletTitle")}</h2>
        </div>
        <button className="secondary">Recibo demo</button>
      </div>

      <div className="wallet-grid">
        <article><span>{t("availableBalance")}</span><strong>EUR 124</strong></article>
        <article><span>{t("protectedBalance")}</span><strong>EUR 48</strong></article>
        <article><span>{t("nextPayout")}</span><strong>24h</strong></article>
      </div>

      <div className="activity-panel">
        <p className="eyebrow">Transacoes</p>
        <div className="match-list">
          <div className="match-item"><span><strong>Cafe Aurora</strong><small>Servico de sala - Lisboa</small></span><small>EUR 44</small></div>
          <div className="match-item"><span><strong>Campus Hub</strong><small>Staff evento - Coimbra</small></span><small>EUR 66</small></div>
          <div className="match-item"><span><strong>Mercado Sol</strong><small>Inventario - Porto</small></span><small>EUR 50</small></div>
        </div>
      </div>
    </section>
  );
}
