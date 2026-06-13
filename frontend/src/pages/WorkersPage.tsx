import { useEffect, useState } from "react";
import { Star, MessageSquare, Search, MapPin, X, Clock, Briefcase } from "lucide-react";
import type { Opportunity, MatchRecord, User } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { api } from "../utils/api";
import { formatDays } from "../utils/weekdays";
import { JobProposalModal } from "../components/JobProposalModal";

type WorkersPageProps = {
  workers: Opportunity[];
  t: (key: TranslationKey) => string;
  user: User;
  employerJobs: MatchRecord[];
  onStartChat: (partnerId: number, partnerName: string, partnerAvatar?: string, jobId?: number) => void;
};

type Review = {
  id: number;
  rating: number;
  comment: string;
  reviewer_name: string;
  created_at: string;
};

type SortKey = "rating" | "pay" | "distance";

export function WorkersPage({ workers, user, employerJobs, onStartChat, t }: WorkersPageProps) {
  const [searchTerm, setSearchTerm]             = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy]                     = useState<SortKey>("rating");
  const [selectedWorker, setSelectedWorker]     = useState<Opportunity | null>(null);
  const [reviews, setReviews]                   = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews]     = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  useEffect(() => {
    if (!selectedWorker) return;
    setLoadingReviews(true);
    api.getReviews(selectedWorker.id)
      .then((data) => { setReviews(data); setLoadingReviews(false); })
      .catch(() => setLoadingReviews(false));
  }, [selectedWorker]);

  const CATEGORIES = [
    { value: "all",         label: t("all") },
    { value: "restauracao", label: `🍽️ ${t("restauracao")}` },
    { value: "eventos",     label: `🎪 ${t("eventos")}` },
    { value: "logistica",   label: `📦 ${t("logistica")}` },
    { value: "casa",        label: `🏠 ${t("casa")}` },
    { value: "retalho",     label: `🛍️ ${t("retalho")}` },
  ];

  const SORT_LABELS: Record<SortKey, string> = {
    rating: t("sortRatingLabel"),
    pay: t("sortTariffLabel"),
    distance: t("sortDistanceLabel"),
  };

  const filtered = workers
    .filter((w) => {
      const q = searchTerm.toLowerCase();
      const matchSearch = w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
      const matchCat = selectedCategory === "all" || w.type === selectedCategory;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === "rating")   return b.rating - a.rating;
      if (sortBy === "pay")      return a.pay - b.pay;
      if (sortBy === "distance") return a.distance - b.distance;
      return 0;
    });

  return (
    <section style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#6366f1", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: "600", margin: "0 0 0.4rem" }}>
          {t("forEmployers")}
        </p>
        <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--ink)", margin: "0 0 0.5rem" }}>
          {t("availableWorkers")}
        </h2>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.9rem" }}>
          {filtered.length} {filtered.length !== 1 ? t("workersFound_other") : t("workersFound_one")} · {t("sortedByLabel")} {SORT_LABELS[sortBy].toLowerCase()}
        </p>
      </div>

      {/* Filters */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="text"
            placeholder={t("workerSearchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.7rem 0.75rem 0.7rem 2.4rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Category pills + sort */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: "20px",
                  border: selectedCategory === cat.value ? "1px solid #6366f1" : "1px solid var(--line)",
                  background: selectedCategory === cat.value ? "#6366f1" : "var(--surface2)",
                  color: selectedCategory === cat.value ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: selectedCategory === cat.value ? "600" : "400",
                  transition: "all 0.15s",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.4rem" }}>
            {(["rating", "pay", "distance"] as SortKey[]).map((key) => {
              const active = sortBy === key;
              return (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "8px",
                    border: active ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--line)",
                    background: active ? "rgba(99,102,241,0.15)" : "var(--surface2)",
                    color: active ? "#a5b4fc" : "var(--muted)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {SORT_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workers grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
        {filtered.map((worker) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            onOpen={() => setSelectedWorker(worker)}
            onChat={() => onStartChat(worker.id, worker.title, `https://api.dicebear.com/7.x/bottts/svg?seed=${worker.title}`, undefined)}
            t={t}
          />
        ))}

        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: "12px" }}>
            <p style={{ color: "var(--muted)", margin: 0 }}>{t("noWorkersFound")}</p>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedWorker && (
        <WorkerDetailDrawer
          worker={selectedWorker}
          reviews={reviews}
          loadingReviews={loadingReviews}
          onClose={() => setSelectedWorker(null)}
          onChat={(jobId?: number) => {
            onStartChat(selectedWorker.id, selectedWorker.title, `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedWorker.title}`, jobId);
            setSelectedWorker(null);
          }}
          onOpenProposal={() => setShowProposalModal(true)}
          t={t}
        />
      )}

      {showProposalModal && selectedWorker && (
        <JobProposalModal
          workerId={selectedWorker.id}
          workerName={selectedWorker.title}
          currentUser={user}
          onClose={() => setShowProposalModal(false)}
          onSent={(jobId) => {
            const w = selectedWorker;
            setShowProposalModal(false);
            setSelectedWorker(null);
            onStartChat(w.id, w.title, `https://api.dicebear.com/7.x/bottts/svg?seed=${w.title}`, jobId);
          }}
        />
      )}
    </section>
  );
}

/* ─── Worker Card ────────────────────────────────────────────────────────────── */

function WorkerCard({ worker, onOpen, onChat, t }: {
  worker: Opportunity;
  onOpen: () => void;
  onChat: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <article
      onClick={onOpen}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "transform 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--line)"; }}
    >
      {/* Top band with avatar + rating badge */}
      <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.08))", padding: "1.5rem 1.25rem 1rem", display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${worker.title}`}
          alt={worker.title}
          style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--surface2)", padding: "3px", border: "2px solid rgba(99,102,241,0.4)", flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: "0 0 0.2rem", fontSize: "1rem", fontWeight: "700", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {worker.title}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
            <span style={{ color: "#facc15", display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <Star size={12} fill="#facc15" />
              {worker.rating.toFixed(1)}
            </span>
            <span style={{ color: "var(--muted)" }}>·</span>
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <MapPin size={11} />
              {worker.distance} km
            </span>
          </div>
        </div>
        <span style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.68rem", fontWeight: "700", padding: "0.2rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.3)" }}>
          {t("workerAvailableBadge")}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "1rem 1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Description */}
        <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {worker.description}
        </p>

        {/* Meta row */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.82rem" }}>
          <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Clock size={12} />
            {worker.time}
          </span>
          <span style={{ marginLeft: "auto", color: "#a5b4fc", fontWeight: "700", fontSize: "1rem" }}>
            €{worker.pay}/h
          </span>
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          📅 {formatDays(worker.days)}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onChat}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              padding: "0.6rem", borderRadius: "10px",
              border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#fff", fontSize: "0.82rem", fontWeight: "700", cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            <MessageSquare size={14} />
            {t("contact")}
          </button>
          <button
            onClick={onOpen}
            style={{
              padding: "0.6rem 0.9rem", borderRadius: "10px",
              border: "1px solid var(--line)", background: "var(--surface2)",
              color: "var(--ink)", fontSize: "0.82rem", cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.75"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            {t("viewProfile")}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ─── Worker Detail Drawer ───────────────────────────────────────────────────── */

function WorkerDetailDrawer({ worker, reviews, loadingReviews, onClose, onChat, onOpenProposal, t }: {
  worker: Opportunity;
  reviews: Review[];
  loadingReviews: boolean;
  onClose: () => void;
  onChat: (jobId?: number) => void;
  onOpenProposal: () => void;
  t: (key: TranslationKey) => string;
}) {

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "440px", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--line)", overflowY: "auto", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top banner */}
        <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(79,70,229,0.1))", padding: "2rem 1.75rem 1.5rem", position: "relative", textAlign: "center" }}>
          <button
            onClick={onClose}
            style={{ position: "absolute", top: "1rem", right: "1rem", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink)", borderRadius: "50%", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={15} />
          </button>
          <img
            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${worker.title}`}
            alt={worker.title}
            style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--surface2)", border: "3px solid #6366f1", padding: "4px", margin: "0 auto 0.75rem" }}
          />
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.3rem", fontWeight: "700", color: "var(--ink)" }}>{worker.title}</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "#facc15", fontSize: "1rem" }}>
            <Star size={16} fill="#facc15" />
            <strong>{worker.rating.toFixed(1)}</strong>
          </div>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            {t("workerAvailableBadge")} · {worker.distance} km {t("distanceFromYou")}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: t("workerRate"), value: `€${worker.pay}/h`, color: "#a5b4fc" },
              { label: t("workerSchedule"), value: worker.time, color: "var(--ink)" },
              { label: t("workerAvailableDays"), value: formatDays(worker.days), color: "var(--ink)" },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.75rem", textAlign: "center" }}>
                <small style={{ color: "var(--muted)", display: "block", fontSize: "0.7rem", marginBottom: "0.2rem" }}>{s.label}</small>
                <strong style={{ color: s.color, fontSize: "0.95rem" }}>{s.value}</strong>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>{t("workerBio")}</h4>
            <p style={{ margin: 0, color: "var(--ink)", fontSize: "0.9rem", lineHeight: "1.6", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.9rem" }}>
              {worker.description}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <button
              onClick={() => onChat(undefined)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem",
                width: "100%", padding: "0.85rem", borderRadius: "12px", border: "none",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff",
                fontWeight: "700", fontSize: "0.95rem", cursor: "pointer",
                boxShadow: "0 4px 15px rgba(99,102,241,0.3)", transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <MessageSquare size={16} />
              {t("sendMessageBtn")}
            </button>

            {/* Propose job button */}
            <button
              onClick={onOpenProposal}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem",
                width: "100%", padding: "0.85rem", borderRadius: "12px",
                border: "1px solid rgba(251,191,36,0.4)",
                background: "rgba(251,191,36,0.08)",
                color: "#f59e0b",
                fontWeight: "700", fontSize: "0.95rem", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.08)"; }}
            >
              <Briefcase size={16} />
              {t("proposeJob")}
            </button>
          </div>

          {/* Reviews */}
          <div>
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>
              {t("recentReviews")}
            </h4>
            {loadingReviews ? (
              <p style={{ color: "var(--muted)", fontSize: "0.87rem" }}>{t("loadingReviews")}</p>
            ) : reviews.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.87rem", fontStyle: "italic" }}>
                {t("noReviews")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {reviews.map((rev) => (
                  <div key={rev.id} style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <span style={{ fontWeight: "600", color: "var(--ink)", fontSize: "0.85rem" }}>{rev.reviewer_name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#facc15", fontSize: "0.8rem" }}>
                        <Star size={11} fill="#facc15" />
                        {rev.rating.toFixed(1)}
                      </div>
                    </div>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.83rem", lineHeight: "1.45" }}>{rev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
