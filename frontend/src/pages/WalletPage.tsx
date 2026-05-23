import { Wallet, TrendingUp, Clock, ArrowDownLeft } from "lucide-react";
import type { TranslationKey } from "../i18n/translations";

type WalletPageProps = {
  t: (key: TranslationKey) => string;
};

const TRANSACTIONS = [
  { company: "Café Aurora",  desc: "Serviço de sala · Lisboa",   amount: 44,  date: "hoje",       status: "paid" },
  { company: "Campus Hub",   desc: "Staff evento · Coimbra",     amount: 66,  date: "ontem",      status: "paid" },
  { company: "Mercado Sol",  desc: "Inventário · Porto",         amount: 50,  date: "20 Mai",     status: "paid" },
  { company: "Norte Log",    desc: "Armazém · Matosinhos",       amount: 32,  date: "17 Mai",     status: "pending" },
];

export function WalletPage({ t }: WalletPageProps) {
  return (
    <section style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#ffd233", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: "700", margin: "0 0 0.4rem" }}>
          Carteira Digital
        </p>
        <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#f0f0ed", margin: 0 }}>
          {t("walletTitle")}
        </h2>
      </div>

      {/* Balance cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { icon: <Wallet size={18} />,     label: t("availableBalance"), value: "€ 124", color: "#22c97a",  bg: "rgba(34,201,122,0.1)",  border: "rgba(34,201,122,0.2)" },
          { icon: <Clock size={18} />,      label: t("protectedBalance"), value: "€ 48",  color: "#ffd233",  bg: "rgba(255,210,51,0.1)",  border: "rgba(255,210,51,0.2)" },
          { icon: <TrendingUp size={18} />, label: t("nextPayout"),       value: "24h",   color: "#4a90e2",  bg: "rgba(74,144,226,0.1)",  border: "rgba(74,144,226,0.2)" },
        ].map((card) => (
          <div
            key={card.label}
            style={{ padding: "1.1rem", border: `1px solid ${card.border}`, borderRadius: "14px", background: card.bg, textAlign: "center" }}
          >
            <div style={{ color: card.color, display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>{card.icon}</div>
            <strong style={{ fontSize: "1.4rem", display: "block", color: "#f0f0ed", fontWeight: "700" }}>{card.value}</strong>
            <small style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{card.label}</small>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ArrowDownLeft size={15} style={{ color: "#22c97a" }} />
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "700", color: "#f0f0ed" }}>Transações Recentes</h3>
        </div>

        <div>
          {TRANSACTIONS.map((tx, i) => (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "1rem 1.25rem",
                borderBottom: i < TRANSACTIONS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                  💼
                </div>
                <div>
                  <strong style={{ display: "block", color: "#f0f0ed", fontSize: "0.88rem" }}>{tx.company}</strong>
                  <small style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.76rem" }}>{tx.desc} · {tx.date}</small>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ color: "#22c97a", fontSize: "1rem" }}>+ € {tx.amount}</strong>
                <small style={{ display: "block", fontSize: "0.7rem", color: tx.status === "paid" ? "rgba(34,201,122,0.6)" : "rgba(255,210,51,0.7)", marginTop: "2px" }}>
                  {tx.status === "paid" ? "Pago" : "Pendente"}
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demo note */}
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "0.78rem", marginTop: "1.5rem" }}>
        Demo · Dados fictícios para demonstração
      </p>
    </section>
  );
}
