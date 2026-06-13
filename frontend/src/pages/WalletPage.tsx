import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Clock, ArrowDownLeft, Lock } from "lucide-react";
import type { TranslationKey } from "../i18n/translations";
import { api } from "../utils/api";

type WalletPageProps = {
  t: (key: TranslationKey) => string;
};

type WalletData = {
  balance: number;
  escrow: number;
  transactions: Array<{ title: string; amount: number; partnerName: string; date: string; status: string }>;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

export function WalletPage({ t }: WalletPageProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWallet()
      .then((data) => { setWallet(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const balance = wallet?.balance ?? 0;
  const escrow = wallet?.escrow ?? 0;
  const transactions = wallet?.transactions ?? [];

  return (
    <section style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "var(--yellow)", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: "700", margin: "0 0 0.4rem" }}>
          {t("digitalWallet")}
        </p>
        <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--ink)", margin: 0 }}>
          {t("walletTitle")}
        </h2>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "3rem" }}>{t("walletLoading")}</div>
      ) : (
        <>
          {/* Balance cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              {
                icon: <Wallet size={18} />,
                label: t("availableBalance"),
                value: `€ ${balance.toFixed(2)}`,
                color: "#22c97a",
                bg: "rgba(34,201,122,0.1)",
                border: "rgba(34,201,122,0.2)",
              },
              {
                icon: <Lock size={18} />,
                label: t("protectedBalance"),
                value: `€ ${escrow.toFixed(2)}`,
                color: "var(--yellow)",
                bg: "rgba(233,189,43,0.12)",
                border: "rgba(233,189,43,0.25)",
              },
              {
                icon: <TrendingUp size={18} />,
                label: t("nextPayout"),
                value: escrow > 0 ? t("pendingPayout") : "—",
                color: "#4a90e2",
                bg: "rgba(74,144,226,0.1)",
                border: "rgba(74,144,226,0.2)",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{ padding: "1.1rem", border: `1px solid ${card.border}`, borderRadius: "14px", background: card.bg, textAlign: "center" }}
              >
                <div style={{ color: card.color, display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>{card.icon}</div>
                <strong style={{ fontSize: "1.3rem", display: "block", color: "var(--ink)", fontWeight: "700" }}>{card.value}</strong>
                <small style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{card.label}</small>
              </div>
            ))}
          </div>

          {/* Escrow notice */}
          {escrow > 0 && (
            <div style={{ marginBottom: "1rem", padding: "0.8rem 1rem", borderRadius: "12px", background: "rgba(255,210,51,0.08)", border: "1px solid rgba(255,210,51,0.2)", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--yellow-dark)", fontSize: "0.85rem", fontWeight: "600" }}>
              <Clock size={15} />
              €{escrow.toFixed(2)} {t("escrowNotice")}
            </div>
          )}

          {/* Transactions */}
          <div style={{ border: "1px solid var(--line)", borderRadius: "16px", background: "var(--surface)", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ArrowDownLeft size={15} style={{ color: "#22c97a" }} />
              <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "700", color: "var(--ink)" }}>{t("transactions")}</h3>
            </div>

            {transactions.length === 0 ? (
              <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "var(--muted)", fontSize: "0.87rem" }}>
                {t("noTransactions")}
              </div>
            ) : (
              <div>
                {transactions.map((tx, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "1rem 1.25rem",
                      borderBottom: i < transactions.length - 1 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                        {tx.status === "released" ? "💼" : "⏳"}
                      </div>
                      <div>
                        <strong style={{ display: "block", color: "var(--ink)", fontSize: "0.88rem" }}>{tx.title}</strong>
                        <small style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
                          {tx.partnerName} · {formatDate(tx.date)}
                        </small>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ color: tx.status === "released" ? "#22c97a" : "var(--yellow)", fontSize: "1rem" }}>
                        {tx.status === "released" ? "+" : "⏸"} € {tx.amount.toFixed(2)}
                      </strong>
                      <small style={{ display: "block", fontSize: "0.7rem", marginTop: "2px", color: tx.status === "released" ? "rgba(34,201,122,0.7)" : "rgba(255,210,51,0.8)" }}>
                        {tx.status === "released" ? t("txPaid") : t("txEscrowed")}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.78rem", marginTop: "1.5rem", opacity: 0.6 }}>
            {t("walletDemoNote")}
          </p>
        </>
      )}
    </section>
  );
}
