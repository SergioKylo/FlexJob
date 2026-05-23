import { useState } from "react";
import { Star, MessageSquare, Search, MapPin, Clock, X, ChevronUp, ChevronDown } from "lucide-react";
import type { Opportunity, MatchRecord } from "../types";

type JobsPageProps = {
  needs: Opportunity[];
  matches: MatchRecord[];
  t: (key: any) => string;
  onCreateMatch: (item: Opportunity) => void;
  onStartChat: (partnerId: number, partnerName: string, partnerAvatar?: string, jobId?: number) => void;
};

const CATEGORY_META: Record<string, { label: string; emoji: string; gradient: string }> = {
  restauracao: { label: "Restauração", emoji: "🍽️", gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" },
  eventos:     { label: "Eventos",     emoji: "🎪", gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)" },
  logistica:   { label: "Logística",   emoji: "📦", gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" },
  casa:        { label: "Casa",        emoji: "🏠", gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)" },
  retalho:     { label: "Retalho",     emoji: "🛍️", gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)" },
};

type SortKey = "distance" | "pay" | "rating";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "distance", label: "Distância" },
  { key: "pay",      label: "Pagamento" },
  { key: "rating",   label: "Avaliação" },
];

const CATEGORIES = [
  { value: "all",        label: "Todas" },
  { value: "restauracao", label: "Restauração" },
  { value: "eventos",    label: "Eventos" },
  { value: "logistica",  label: "Logística" },
  { value: "casa",       label: "Casa" },
  { value: "retalho",    label: "Retalho" },
];

export function JobsPage({ needs, matches, onCreateMatch, onStartChat }: JobsPageProps) {
  const [searchTerm, setSearchTerm]           = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortKey, setSortKey]                 = useState<SortKey>("distance");
  const [sortAsc, setSortAsc]                 = useState(true);
  const [selectedJob, setSelectedJob]         = useState<Opportunity | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "distance"); }
  }

  const filtered = needs
    .filter((job) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        job.title.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q) ||
        job.requester.toLowerCase().includes(q);
      const matchesCat = selectedCategory === "all" || job.type === selectedCategory;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "distance") diff = a.distance - b.distance;
      if (sortKey === "pay")      diff = a.pay - b.pay;
      if (sortKey === "rating")   diff = a.rating - b.rating;
      return sortAsc ? diff : -diff;
    });

  return (
    <section style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#6366f1", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: "600", margin: "0 0 0.4rem" }}>
          Trabalhos próximos de si
        </p>
        <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff", margin: "0 0 0.5rem" }}>
          Oportunidades disponíveis
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, fontSize: "0.9rem" }}>
          {filtered.length} vaga{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""} · ordenadas por {SORT_OPTIONS.find(s => s.key === sortKey)?.label.toLowerCase()}
        </p>
      </div>

      {/* Search + filters */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }} />
          <input
            type="text"
            placeholder="Pesquisar por título, empresa ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.7rem 0.75rem 0.7rem 2.4rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
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
                  padding: "0.4rem 0.9rem",
                  borderRadius: "20px",
                  border: selectedCategory === cat.value ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                  background: selectedCategory === cat.value ? "#6366f1" : "rgba(255,255,255,0.04)",
                  color: "#fff",
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

          {/* Sort buttons */}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {SORT_OPTIONS.map((s) => {
              const active = sortKey === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSort(s.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "8px",
                    border: active ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                    color: active ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {s.label}
                  {active && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Jobs grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {filtered.map((job) => {
          const meta = CATEGORY_META[job.type] ?? { label: job.type, emoji: "💼", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" };
          const applied = matches.some((m) => m.itemId === job.id);

          return (
            <JobCard
              key={job.id}
              job={job}
              meta={meta}
              applied={applied}
              onOpen={() => setSelectedJob(job)}
              onApply={() => onCreateMatch(job)}
              onChat={() => onStartChat(job.employerId!, job.requester, `https://api.dicebear.com/7.x/bottts/svg?seed=${job.requester}`, job.id)}
            />
          );
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem 1rem", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>Nenhuma vaga encontrada com os filtros atuais.</p>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          applied={matches.some((m) => m.itemId === selectedJob.id)}
          onClose={() => setSelectedJob(null)}
          onApply={() => { onCreateMatch(selectedJob); setSelectedJob(null); }}
          onChat={() => { onStartChat(selectedJob.employerId!, selectedJob.requester, `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedJob.requester}`, selectedJob.id); setSelectedJob(null); }}
        />
      )}
    </section>
  );
}

/* ─── Job Card ─────────────────────────────────────────────────────────────── */

function JobCard({ job, meta, applied, onOpen, onApply, onChat }: {
  job: Opportunity;
  meta: { label: string; emoji: string; gradient: string };
  applied: boolean;
  onOpen: () => void;
  onApply: () => void;
  onChat: () => void;
}) {
  return (
    <article
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s, border-color 0.2s",
        cursor: "pointer",
      }}
      onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      {/* Image / placeholder */}
      <div style={{ position: "relative", height: "150px", background: job.photo ? "transparent" : meta.gradient, flexShrink: 0 }}>
        {job.photo ? (
          <img src={job.photo} alt={job.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem", opacity: 0.85 }}>
            {meta.emoji}
          </div>
        )}

        {/* Overlaid badges */}
        <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", right: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "0.72rem", fontWeight: "600", padding: "0.25rem 0.55rem", borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <MapPin size={11} />
            {job.distance} km
          </span>
          <span style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "0.72rem", fontWeight: "500", padding: "0.25rem 0.55rem", borderRadius: "8px" }}>
            {meta.label}
          </span>
        </div>

        {applied && (
          <span style={{ position: "absolute", bottom: "0.6rem", right: "0.75rem", background: "rgba(16,185,129,0.85)", color: "#fff", fontSize: "0.7rem", fontWeight: "700", padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
            Candidatado
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", flex: 1, gap: "0.75rem" }}>
        {/* Company row */}
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <img
            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${job.requester}`}
            alt={job.requester}
            style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", padding: "2px", flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.requester}</p>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</h3>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.82rem" }}>
          <span style={{ color: "#facc15", display: "flex", alignItems: "center", gap: "0.2rem" }}>
            <Star size={12} fill="#facc15" />
            {job.rating.toFixed(1)}
          </span>
          <span style={{ color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
            <Clock size={12} />
            {job.hours}h · {job.time}
          </span>
          <span style={{ marginLeft: "auto", color: "#a5b4fc", fontWeight: "700", fontSize: "1rem" }}>
            €{job.pay}/h
          </span>
        </div>

        {/* Location */}
        <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <MapPin size={12} style={{ color: "#6366f1", flexShrink: 0 }} />
          {job.address || job.city}
        </p>

        {/* Description */}
        <p style={{ margin: 0, fontSize: "0.83rem", color: "rgba(255,255,255,0.6)", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {job.description}
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "auto", paddingTop: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
          {applied ? (
            <button disabled style={{ flex: 1, padding: "0.6rem", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: "0.82rem", fontWeight: "700", cursor: "default" }}>
              Candidatado ✓
            </button>
          ) : (
            <button
              onClick={() => onApply()}
              style={{ flex: 1, padding: "0.6rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: "0.82rem", fontWeight: "700", cursor: "pointer", transition: "opacity 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              Candidatar
            </button>
          )}
          <button
            onClick={() => onChat()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "0.6rem 0.9rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "0.82rem", fontWeight: "600", cursor: "pointer", transition: "background 0.15s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            <MessageSquare size={14} />
            Contactar
          </button>
        </div>
      </div>
    </article>
  );
}

/* ─── Detail Drawer ─────────────────────────────────────────────────────────── */

function JobDetailDrawer({ job, applied, onClose, onApply, onChat }: {
  job: Opportunity;
  applied: boolean;
  onClose: () => void;
  onApply: () => void;
  onChat: () => void;
}) {
  const meta = CATEGORY_META[job.type] ?? { label: job.type, emoji: "💼", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "460px", height: "100%", background: "#1a1a1a", borderLeft: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div style={{ position: "relative", height: "220px", background: job.photo ? "transparent" : meta.gradient, flexShrink: 0 }}>
          {job.photo ? (
            <img src={job.photo} alt={job.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>
              {meta.emoji}
            </div>
          )}
          <button
            onClick={onClose}
            style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
          <div style={{ position: "absolute", bottom: "1rem", left: "1rem", display: "flex", gap: "0.5rem" }}>
            <span style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "0.75rem", fontWeight: "600", padding: "0.3rem 0.65rem", borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <MapPin size={12} />
              {job.distance} km de si
            </span>
            <span style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "8px" }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
          {/* Company + title */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${job.requester}`}
              alt={job.requester}
              style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", padding: "2px", flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.45)" }}>{job.requester}</p>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700", color: "#fff" }}>{job.title}</h2>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "Pagamento", value: `€${job.pay}/h`, color: "#a5b4fc" },
              { label: "Duração", value: `${job.hours}h`, color: "#fff" },
              { label: "Avaliação", value: `★ ${job.rating.toFixed(1)}`, color: "#facc15" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "0.75rem", textAlign: "center" }}>
                <small style={{ color: "rgba(255,255,255,0.4)", display: "block", fontSize: "0.7rem", marginBottom: "0.2rem" }}>{stat.label}</small>
                <strong style={{ color: stat.color, fontSize: "1rem" }}>{stat.value}</strong>
              </div>
            ))}
          </div>

          {/* Location */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "0.9rem" }}>
            <MapPin size={16} style={{ color: "#6366f1", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <small style={{ color: "rgba(255,255,255,0.4)", display: "block", fontSize: "0.72rem" }}>Morada</small>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.9rem" }}>{job.address || job.city}</span>
              <br />
              <small style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>a {job.distance} km de si · início às {job.time}</small>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255,255,255,0.35)" }}>Descrição da Vaga</h4>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", lineHeight: "1.65", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "0.9rem", whiteSpace: "pre-wrap" }}>
              {job.description}
            </p>
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "auto", paddingTop: "0.5rem" }}>
            {applied ? (
              <button disabled style={{ width: "100%", padding: "0.9rem", borderRadius: "12px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontWeight: "700", fontSize: "1rem" }}>
                Candidatura Efetuada ✓
              </button>
            ) : (
              <button
                onClick={onApply}
                style={{ width: "100%", padding: "0.9rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: "700", fontSize: "1rem", cursor: "pointer", boxShadow: "0 4px 15px rgba(16,185,129,0.25)", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.88"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                Candidatar-me a Esta Vaga
              </button>
            )}
            <button
              onClick={onChat}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", width: "100%", padding: "0.9rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", fontWeight: "700", fontSize: "1rem", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <MessageSquare size={18} />
              Enviar Mensagem ao Empregador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
