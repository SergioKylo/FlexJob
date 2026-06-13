import { toast } from "../utils/toast";
import { useEffect, useState } from "react";
import { Star, MessageSquare, Search, MapPin, Clock, X, ChevronUp, ChevronDown, Settings } from "lucide-react";
import type { Opportunity, MatchRecord, User } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { api } from "../utils/api";
import { WEEKDAYS } from "../utils/weekdays";

type JobsPageProps = {
  needs: Opportunity[];
  matches: MatchRecord[];
  t: (key: TranslationKey) => string;
  user: User;
  onCreateMatch: (item: Opportunity) => void;
  onStartChat: (partnerId: number, partnerName: string, partnerAvatar?: string, jobId?: number) => void;
};

const CATEGORY_META: Record<string, { emoji: string; gradient: string }> = {
  restauracao: { emoji: "🍽️", gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" },
  eventos:     { emoji: "🎪", gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)" },
  logistica:   { emoji: "📦", gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" },
  casa:        { emoji: "🏠", gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)" },
  retalho:     { emoji: "🛍️", gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)" },
};

const REGIONS = [
  { name: "Lisboa",                 lat: 38.7223, lng: -9.1393  },
  { name: "Porto",                  lat: 41.1579, lng: -8.6291  },
  { name: "Coimbra",                lat: 40.2033, lng: -8.4103  },
  { name: "Braga",                  lat: 41.5454, lng: -8.4265  },
  { name: "Faro (Algarve)",         lat: 37.0179, lng: -7.9308  },
  { name: "Funchal (Madeira)",      lat: 32.6500, lng: -16.9    },
  { name: "Ponta Delgada (Açores)", lat: 37.7412, lng: -25.6756 },
  { name: "Évora (Alentejo)",       lat: 38.5714, lng: -7.9096  },
];

function nearestRegion(lat?: number, lng?: number): string {
  if (!lat || !lng) return "Lisboa";
  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(r.lat - lat, r.lng - lng);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best.name;
}

type SortKey = "distance" | "pay" | "rating";

export function JobsPage({ needs, matches, onCreateMatch, onStartChat, t, user }: JobsPageProps) {
  const [searchTerm, setSearchTerm]           = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortKey, setSortKey]                 = useState<SortKey>("distance");
  const [sortAsc, setSortAsc]                 = useState(true);
  const [selectedJob, setSelectedJob]         = useState<Opportunity | null>(null);

  // Availability form state (workers only)
  const [showAvail, setShowAvail]   = useState(false);
  const [availRegion, setAvailRegion] = useState(nearestRegion(user.lat, user.lng));
  const [availRate, setAvailRate]   = useState(10);
  const [availRadius, setAvailRadius] = useState(10);
  const [availStart, setAvailStart] = useState("09:00");
  const [availEnd, setAvailEnd]     = useState("18:00");
  const [availActive, setAvailActive] = useState(true);
  const [availCategory, setAvailCategory] = useState("restauracao");
  const [availDays, setAvailDays]   = useState<string[]>([]);
  const [savingAvail, setSavingAvail] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  // Pre-fill the form with the worker's saved availability
  useEffect(() => {
    if (user.role !== "worker") return;
    api.getMyAvailability()
      .then((a) => {
        setAvailRegion(nearestRegion(a.lat, a.lng));
        setAvailRate(a.hourlyRate);
        setAvailRadius(a.radius);
        setAvailStart(a.startTime || "09:00");
        setAvailEnd(a.endTime || "18:00");
        setAvailActive(a.isActive);
        if (a.category && a.category !== "outros") setAvailCategory(a.category);
        setAvailDays(a.days ? a.days.split(",").filter(Boolean) : []);
      })
      .catch(() => { /* no availability saved yet — keep defaults */ });
  }, [user.id, user.role]);

  function toggleDay(key: string) {
    setAvailDays((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  }

  async function handleSaveAvailability(e: React.FormEvent) {
    e.preventDefault();
    const r = REGIONS.find((x) => x.name === availRegion) ?? REGIONS[0];
    setSavingAvail(true);
    try {
      await api.updateAvailability({
        lat: r.lat, lng: r.lng,
        radius: availRadius,
        startTime: availStart,
        endTime: availEnd,
        hourlyRate: availRate,
        isActive: availActive,
        category: availCategory,
        days: availDays.join(","),
      });
      setAvailSaved(true);
      setShowAvail(false);
      setTimeout(() => setAvailSaved(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao guardar disponibilidade.");
    } finally {
      setSavingAvail(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "distance"); }
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "distance", label: t("sortDistance") },
    { key: "pay",      label: t("sortPay") },
    { key: "rating",   label: t("sortRating") },
  ];

  const CATEGORIES = [
    { value: "all",        label: t("catAll") },
    { value: "restauracao", label: t("restauracao") },
    { value: "eventos",    label: t("eventos") },
    { value: "logistica",  label: t("logistica") },
    { value: "casa",       label: t("casa") },
    { value: "retalho",    label: t("retalho") },
  ];

  const AVAIL_CATEGORIES = [
    { value: "restauracao", label: t("restauracao") },
    { value: "eventos",     label: t("eventos") },
    { value: "logistica",   label: t("logistica") },
    { value: "casa",        label: t("casa") },
    { value: "retalho",     label: t("retalho") },
  ];

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

  const activeSortLabel = SORT_OPTIONS.find((s) => s.key === sortKey)?.label.toLowerCase() ?? "";

  return (
    <section style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Availability panel for workers */}
      {user.role === "worker" && (
        <div style={{ marginBottom: "1.5rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", overflow: "hidden" }}>
          <button
            onClick={() => setShowAvail((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.9rem 1.25rem", background: "none", border: "none", cursor: "pointer",
              color: "var(--ink)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Settings size={16} style={{ color: "#6366f1" }} />
              <span style={{ fontWeight: "700", fontSize: "0.9rem" }}>{t("myAvailabilityTitle")}</span>
              {availSaved && <span style={{ fontSize: "0.75rem", color: "#22c97a", fontWeight: "600" }}>{t("availabilitySaved")}</span>}
            </div>
            {showAvail ? <ChevronUp size={16} style={{ color: "var(--muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted)" }} />}
          </button>

          {showAvail && (
            <form onSubmit={handleSaveAvailability} style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0.75rem 0 1rem" }}>
                {t("availabilitySubtitle")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("regionLabel")}</span>
                  <select value={availRegion} onChange={(e) => setAvailRegion(e.target.value)}
                    style={{ padding: "0.5rem 0.7rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }}>
                    {REGIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("rateLabel")}</span>
                  <input type="number" min={5} max={200} value={availRate} onChange={(e) => setAvailRate(Number(e.target.value))}
                    style={{ padding: "0.5rem 0.7rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("radiusLabel")}</span>
                  <input type="number" min={1} max={100} value={availRadius} onChange={(e) => setAvailRadius(Number(e.target.value))}
                    style={{ padding: "0.5rem 0.7rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }} />
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("scheduleLabel")}</span>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <input type="time" value={availStart} onChange={(e) => setAvailStart(e.target.value)}
                      style={{ flex: 1, padding: "0.5rem 0.4rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.82rem" }} />
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>–</span>
                    <input type="time" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)}
                      style={{ flex: 1, padding: "0.5rem 0.4rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.82rem" }} />
                  </div>
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("categoryLabel")}</span>
                  <select value={availCategory} onChange={(e) => setAvailCategory(e.target.value)}
                    style={{ padding: "0.5rem 0.7rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.88rem" }}>
                    {AVAIL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ marginBottom: "0.9rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("availableDays")}</span>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                  {WEEKDAYS.map((d) => {
                    const on = availDays.includes(d.key);
                    return (
                      <button type="button" key={d.key} onClick={() => toggleDay(d.key)}
                        style={{
                          padding: "0.35rem 0.75rem", borderRadius: "16px", cursor: "pointer",
                          border: on ? "1px solid #6366f1" : "1px solid var(--line)",
                          background: on ? "rgba(99,102,241,0.18)" : "var(--surface2)",
                          color: on ? "#a5b4fc" : "var(--muted)", fontSize: "0.78rem", fontWeight: "600",
                        }}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--muted)", margin: "0.35rem 0 0" }}>
                  {t("noDaysSelected")}
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem", cursor: "pointer" }}>
                <input type="checkbox" checked={availActive} onChange={(e) => setAvailActive(e.target.checked)} style={{ width: "16px", height: "16px" }} />
                <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t("availableActive")}</span>
              </label>
              <button type="submit" disabled={savingAvail}
                style={{ width: "100%", padding: "0.65rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", opacity: savingAvail ? 0.6 : 1 }}>
                {savingAvail ? t("savingAvailability") : t("saveAvailability")}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#6366f1", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: "600", margin: "0 0 0.4rem" }}>
          {t("jobsNearby")}
        </p>
        <h2 style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--ink)", margin: "0 0 0.5rem" }}>
          {t("availableOpportunities")}
        </h2>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.9rem" }}>
          {filtered.length} {filtered.length !== 1 ? t("vacanciesFound_other") : t("vacanciesFound_one")} · {t("sortedBy")} {activeSortLabel}
        </p>
      </div>

      {/* Search + filters */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="text"
            placeholder={t("jobSearchPlaceholder")}
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
                  padding: "0.4rem 0.9rem",
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
                    border: active ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--line)",
                    background: active ? "rgba(99,102,241,0.15)" : "var(--surface2)",
                    color: active ? "#a5b4fc" : "var(--muted)",
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
          const meta = CATEGORY_META[job.type] ?? { emoji: "💼", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" };
          const applied = matches.some((m) => m.itemId === job.id);

          return (
            <JobCard
              key={job.id}
              job={job}
              meta={{ ...meta, label: t(job.type as any) || job.type }}
              applied={applied}
              onOpen={() => setSelectedJob(job)}
              onApply={() => onCreateMatch(job)}
              onChat={() => onStartChat(job.employerId!, job.requester, `https://api.dicebear.com/7.x/bottts/svg?seed=${job.requester}`, job.id)}
              t={t}
            />
          );
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem 1rem", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: "12px" }}>
            <p style={{ color: "var(--muted)", margin: 0 }}>{t("noJobsFound")}</p>
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
          t={t}
        />
      )}
    </section>
  );
}

/* ─── Job Card ─────────────────────────────────────────────────────────────── */

function JobCard({ job, meta, applied, onOpen, onApply, onChat, t }: {
  job: Opportunity;
  meta: { label: string; emoji: string; gradient: string };
  applied: boolean;
  onOpen: () => void;
  onApply: () => void;
  onChat: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s, border-color 0.2s",
        cursor: "pointer",
      }}
      onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--line)"; }}
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
            {t("applied")}
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
            style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--surface2)", padding: "2px", flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.requester}</p>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</h3>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.82rem" }}>
          <span style={{ color: "#facc15", display: "flex", alignItems: "center", gap: "0.2rem" }}>
            <Star size={12} fill="#facc15" />
            {job.rating.toFixed(1)}
          </span>
          <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
            <Clock size={12} />
            {job.hours}h · {job.time}
          </span>
          <span style={{ marginLeft: "auto", color: "#a5b4fc", fontWeight: "700", fontSize: "1rem" }}>
            €{job.pay}/h
          </span>
        </div>

        {/* Location */}
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <MapPin size={12} style={{ color: "#6366f1", flexShrink: 0 }} />
          {job.address || job.city}
        </p>

        {/* Description */}
        <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--muted)", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {job.description}
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "auto", paddingTop: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
          {applied ? (
            <button disabled style={{ flex: 1, padding: "0.6rem", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: "0.82rem", fontWeight: "700", cursor: "default" }}>
              {t("appliedCheck")}
            </button>
          ) : (
            <button
              onClick={() => onApply()}
              style={{ flex: 1, padding: "0.6rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: "0.82rem", fontWeight: "700", cursor: "pointer", transition: "opacity 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              {t("apply")}
            </button>
          )}
          <button
            onClick={() => onChat()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "0.6rem 0.9rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.82rem", fontWeight: "600", cursor: "pointer", transition: "background 0.15s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.75"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            <MessageSquare size={14} />
            {t("contact")}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ─── Detail Drawer ─────────────────────────────────────────────────────────── */

function JobDetailDrawer({ job, applied, onClose, onApply, onChat, t }: {
  job: Opportunity;
  applied: boolean;
  onClose: () => void;
  onApply: () => void;
  onChat: () => void;
  t: (key: TranslationKey) => string;
}) {
  const meta = CATEGORY_META[job.type] ?? { emoji: "💼", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "460px", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--line)", overflowY: "auto", display: "flex", flexDirection: "column" }}
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
              {job.distance} km {t("distanceFromYou")}
            </span>
            <span style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "8px" }}>
              {t(job.type as any) || job.type}
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
              style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--surface2)", padding: "2px", flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>{job.requester}</p>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700", color: "var(--ink)" }}>{job.title}</h2>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: t("jobPayment"), value: `€${job.pay}/h`, color: "#a5b4fc" },
              { label: t("jobDuration"), value: `${job.hours}h`, color: "var(--ink)" },
              { label: t("jobRating"), value: `★ ${job.rating.toFixed(1)}`, color: "#facc15" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.75rem", textAlign: "center" }}>
                <small style={{ color: "var(--muted)", display: "block", fontSize: "0.7rem", marginBottom: "0.2rem" }}>{stat.label}</small>
                <strong style={{ color: stat.color, fontSize: "1rem" }}>{stat.value}</strong>
              </div>
            ))}
          </div>

          {/* Location */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.9rem" }}>
            <MapPin size={16} style={{ color: "#6366f1", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <small style={{ color: "var(--muted)", display: "block", fontSize: "0.72rem" }}>{t("jobAddress")}</small>
              <span style={{ color: "var(--ink)", fontSize: "0.9rem" }}>{job.address || job.city}</span>
              <br />
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{t("distanceFromYou")} {job.distance} km · {t("startTime")} {job.time}</small>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>{t("jobDescription")}</h4>
            <p style={{ margin: 0, color: "var(--ink)", fontSize: "0.9rem", lineHeight: "1.65", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.9rem", whiteSpace: "pre-wrap" }}>
              {job.description}
            </p>
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "auto", paddingTop: "0.5rem" }}>
            {applied ? (
              <button disabled style={{ width: "100%", padding: "0.9rem", borderRadius: "12px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: "#10b981", fontWeight: "700", fontSize: "1rem" }}>
                {t("applicationDone")}
              </button>
            ) : (
              <button
                onClick={onApply}
                style={{ width: "100%", padding: "0.9rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: "700", fontSize: "1rem", cursor: "pointer", boxShadow: "0 4px 15px rgba(16,185,129,0.25)", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.88"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                {t("applyToJob")}
              </button>
            )}
            <button
              onClick={onChat}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", width: "100%", padding: "0.9rem", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: "700", fontSize: "1rem", cursor: "pointer", transition: "opacity 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <MessageSquare size={18} />
              {t("sendMessage")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
