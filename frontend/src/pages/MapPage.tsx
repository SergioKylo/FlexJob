import { toast as notify } from "../utils/toast";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { Plus, Search, MapPin, DollarSign, Star, CheckCircle, X, MessageCircle } from "lucide-react";
import type { MatchRecord, Opportunity, SortMode, WorkMode, User } from "../types";
import type { TranslationKey } from "../i18n/translations";
import { sortOpportunities } from "../utils/matching";
import { api } from "../utils/api";

type MapPageProps = {
  mode: WorkMode;
  needs: Opportunity[];
  workers: Opportunity[];
  matches: MatchRecord[];
  onCreateMatch: (item: Opportunity) => void;
  onModeChange: (mode: WorkMode) => void;
  t: (key: TranslationKey) => string;
  user: User;
  onRefresh?: () => void;
  onStartChat: (partnerId: number, partnerName: string, partnerAvatar?: string, jobId?: number) => void;
};

function CenterMap({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();
  const prevCoords = useRef<string>("");

  useEffect(() => {
    if (lat !== undefined && lng !== undefined) {
      const coordStr = `${lat},${lng}`;
      if (prevCoords.current !== coordStr) {
        prevCoords.current = coordStr;
        map.setView([lat, lng], 12);
      }
    }
  }, [lat, lng, map]);

  return null;
}

function FlyToMarker({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef("");
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (prev.current !== key) {
      prev.current = key;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { animate: true, duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

function iconFor(item: Opportunity, mode: WorkMode, active: boolean) {
  const content = mode === "work" ? `★${item.rating.toFixed(1)}` : `${item.pay}€`;
  return L.divIcon({
    className: `flex-marker ${mode === "work" ? "worker" : ""} ${active ? "active" : ""}`,
    html: `<span>${content}</span>`,
    iconSize: [46, 46],
    iconAnchor: [23, 41],
  });
}

export function MapPage({ mode: initialMode, needs: initialNeeds, matches, onCreateMatch, onModeChange, t, user, onRefresh, onStartChat }: MapPageProps) {
  const isEmployer = user.role === "employer";
  const effectiveMode: WorkMode = "need"; // Both employers and workers see jobs on the map

  const [activeId, setActiveId] = useState<number | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortMode>("match");

  // Dynamic lists from backend
  const [jobs, setJobs] = useState<Opportunity[]>(initialNeeds);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);

  // Job Form Fields
  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobCat, setJobCat] = useState("restauracao");
  const [jobPay, setJobPay] = useState(12);
  const [jobAddress, setJobAddress] = useState("");
  const [jobDuration, setJobDuration] = useState("4 horas");
  const [jobWorkDate, setJobWorkDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [jobPhoto, setJobPhoto] = useState<string>("");
  const [geocoding, setGeocoding] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Fetch initial/refreshed data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getJobs(user.lat, user.lng);
      setJobs(data);
    } catch (err) {
      console.error("Error loading map data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);


  const rawData = jobs;

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return sortOpportunities(
      rawData.filter((item) => {
        const matchesCategory = category === "all" || item.type === category;
        const matchesQuery = `${item.title} ${item.city} ${item.requester} ${item.description}`.toLowerCase().includes(normalized);
        return matchesCategory && matchesQuery;
      }),
      sort,
    );
  }, [category, rawData, query, sort]);

  const activeItem = activeId !== null ? (filtered.find((item) => item.id === activeId) ?? null) : null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function isMatched(item: Opportunity) {
    return matches.some((match) => match.itemId === item.id && match.mode === effectiveMode);
  }

  // Handle posting a job
  async function handlePostJob(e: React.FormEvent) {
    e.preventDefault();
    setGeocoding(true);

    let lat = user.lat ?? 38.7223;
    let lng = user.lng ?? -9.1393;

    try {
      // Nominatim OSM geocoding request to resolve the text address
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(jobAddress)}&format=json&limit=1`;
      const response = await fetch(geocodeUrl, {
        headers: {
          "Accept-Language": "pt",
          "User-Agent": "FlexJobApp"
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        } else {
          notify.error(t("geocodeFallback"));
        }
      } else {
        notify.error(t("geocodeServiceDown"));
      }

      await api.postJob({
        title: jobTitle,
        description: jobDesc,
        category: jobCat,
        lat,
        lng,
        address: jobAddress,
        pay: jobPay,
        payType: "hourly",
        duration: jobDuration,
        workDate: jobWorkDate,
        photo: jobPhoto || undefined,
      });

      dialogRef.current?.close();
      showToast(t("jobPostedSuccess"));

      // Reset job fields
      setJobTitle("");
      setJobDesc("");
      setJobAddress("");
      setJobPhoto("");
      setJobWorkDate(new Date().toISOString().split("T")[0]);

      // Reload jobs
      const freshJobs = await api.getJobs(user.lat, user.lng);
      setJobs(freshJobs);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      notify.error(err.message || "Erro ao publicar a vaga.");
    } finally {
      setGeocoding(false);
    }
  }

  const JOB_CATEGORIES = [
    { key: "all",         emoji: "🗂️", label: t("filterAll") },
    { key: "restauracao", emoji: "🍽️", label: t("restauracao") },
    { key: "eventos",     emoji: "🎪", label: t("eventos") },
    { key: "logistica",   emoji: "📦", label: t("logistica") },
    { key: "casa",        emoji: "🏠", label: t("casa") },
    { key: "retalho",     emoji: "🛒", label: t("retalho") },
  ];


  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "6px 2px 10px" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          {isEmployer ? t("employerPanel") : t("workerPanel")}
        </p>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ display: "inline-flex", gap: "4px", alignItems: "center", padding: "3px 10px", borderRadius: "999px", background: "var(--surface2)", border: "1px solid var(--line)", fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
            <strong>{filtered.length}</strong><small style={{ color: "var(--muted)", fontWeight: 600 }}>{t("vacancies")}</small>
          </span>
          <span style={{ display: "inline-flex", gap: "4px", alignItems: "center", padding: "3px 10px", borderRadius: "999px", background: "rgba(34,201,122,0.1)", border: "1px solid rgba(34,201,122,0.22)", fontSize: "12px", fontWeight: 700, color: "var(--green)" }}>
            ★ {user.rating?.toFixed(1) ?? "5.0"}
          </span>
        </div>
      </div>

      <section className="workspace" style={{ height: "calc(100dvh - 155px)" }}>
        <aside className="control-panel">
          {/* User Specific Quick Controls */}
          {isEmployer && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button
                className="primary full"
                onClick={() => dialogRef.current?.showModal()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "var(--yellow)", color: "#181506" }}
              >
                <Plus size={18} />
                {t("publishJob")}
              </button>
            </div>
          )}

          {(<>
              {/* Search and Filters */}
              <div className="search-box">
                <Search size={18} style={{ color: "var(--muted)" }} />
                <input placeholder={t("jobSearchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>

              <div className="filters" style={{ gap: "5px" }}>
                {JOB_CATEGORIES.map(({ key, emoji, label }) => (
                  <button
                    key={key}
                    className={`chip ${category === key ? "active" : ""}`}
                    onClick={() => setCategory(key)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <span>{emoji}</span>{label}
                  </button>
                ))}
              </div>

              {/* Sort: segmented control */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0 2px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0 }}>{t("sortOrder")}</span>
                <div style={{ display: "flex", flex: 1, background: "var(--bg)", borderRadius: "10px", border: "1px solid var(--line)", padding: "3px", gap: "2px" }}>
                  {(["match", "pay", "distance", "rating"] as SortMode[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      style={{
                        flex: 1, padding: "4px 2px", borderRadius: "7px", border: "none",
                        background: sort === s ? "var(--yellow)" : "transparent",
                        color: sort === s ? "#181506" : "var(--muted)",
                        fontSize: "10px", fontWeight: 700, cursor: "pointer",
                        transition: "all 0.15s", whiteSpace: "nowrap",
                      }}
                    >
                      {s === "match" ? "★ Match" : s === "pay" ? "€ Pag." : s === "distance" ? "📍 Dist." : "⭐ Aval."}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job list header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px 8px", borderTop: "1px solid var(--line)", marginTop: "2px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  {loading
                    ? t("loadingJobs")
                    : `${filtered.length} ${filtered.length !== 1 ? t("jobsFound_other") : t("jobsFound_one")}`
                  }
                </span>
                {!loading && filtered.length > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{t("clickToSeeOnMap")}</span>
                )}
              </div>

              <div className="job-list" style={{ flex: 1 }}>
                {!loading && filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 10px", fontSize: "14px" }}>
                    {t("noJobsInArea")}
                  </div>
                )}
                {filtered.map((item) => (
                  <article className={`job-card ${activeItem?.id === item.id ? "active" : ""} ${isMatched(item) ? "matched" : ""}`} key={item.id}
                    onClick={() => { setActiveId(item.id); setFlyTarget({ lat: item.lat, lng: item.lng }); }}>
                    <div className="job-meta">
                      <span className="tag">{t(item.type as TranslationKey)}</span>
                      <span className="pay">EUR {item.pay}/h</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>{item.description}</p>
                    <small style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      <span>📍 {item.city}</span>
                      <span>• 🚗 {item.distance} km</span>
                      <span>• ⏱️ {item.time}</span>
                    </small>
                    <div className="job-foot" style={{ marginTop: "10px" }}>
                      <span className="score" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Star size={12} fill="currentColor" />
                        <span>{item.rating.toFixed(1)} {t("classification")}</span>
                      </span>
                      {!isEmployer && (
                        <button
                          onClick={(event) => { event.stopPropagation(); if (!isMatched(item)) onCreateMatch(item); }}
                          disabled={isMatched(item)}
                          style={{ opacity: isMatched(item) ? 0.55 : 1 }}
                        >
                          {isMatched(item) ? `✓ ${t("applied")}` : t("apply")}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="map-panel">
          <MapContainer center={[user.lat ?? 38.7223, user.lng ?? -9.1393]} zoom={user.lat ? 12 : 7} className="leaflet-map" zoomControl>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <CenterMap lat={user.lat} lng={user.lng} />
            {flyTarget && <FlyToMarker lat={flyTarget.lat} lng={flyTarget.lng} />}

            {/* Display list items */}
            {filtered.map((item) => (
              <Marker
                eventHandlers={{ click: () => setActiveId(item.id) }}
                icon={iconFor(item, effectiveMode, activeItem?.id === item.id)}
                key={item.id}
                position={[item.lat, item.lng]}
              />
            ))}

          </MapContainer>

          {activeItem && (
            <div className="map-detail" style={{ maxHeight: "420px", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="tag" style={{ marginBottom: "6px", display: "inline-block" }}>
                    {t(activeItem.type as TranslationKey)}
                  </span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "700", margin: "4px 0 2px", color: "var(--ink)", lineHeight: 1.2 }}>
                    {activeItem.title}
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                    {t("postedBy")} {activeItem.requester}
                  </p>
                </div>
                <button onClick={() => setActiveId(null)} className="reset-button" style={{ color: "var(--muted)", padding: "4px", flexShrink: 0, marginLeft: "8px" }}>
                  <X size={18} />
                </button>
              </div>

              {/* Pill row: pay, rating, distance */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", background: "rgba(255,210,51,0.15)", border: "1px solid rgba(255,210,51,0.25)", color: "var(--yellow)", fontSize: "13px", fontWeight: "800" }}>
                  <DollarSign size={12} />
                  {activeItem.pay}€/h
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", background: "rgba(34,201,122,0.12)", border: "1px solid rgba(34,201,122,0.22)", color: "var(--green)", fontSize: "13px", fontWeight: "700" }}>
                  <Star size={12} fill="currentColor" />
                  {activeItem.rating.toFixed(1)}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: "12px", fontWeight: "600" }}>
                  <MapPin size={12} />
                  {activeItem.city} · {activeItem.distance} km
                </span>
              </div>

              {/* Job Photo */}
              {activeItem.photo && (
                <div style={{ marginBottom: "12px", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)" }}>
                  <img src={activeItem.photo} alt={activeItem.title} style={{ width: "100%", maxHeight: "140px", objectFit: "cover", display: "block" }} />
                </div>
              )}

              {/* Description */}
              <div style={{ marginBottom: "12px" }}>
                <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: "6px" }}>{t("description")}</h4>
                <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.45, margin: "0 0 4px" }}>{activeItem.description}</p>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0, opacity: 0.75 }}>⏳ {activeItem.time}</p>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
                <button
                  onClick={() => {
                    onStartChat(activeItem.employerId ?? 0, activeItem.requester, undefined, activeItem.id);
                  }}
                  className="secondary"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", minHeight: "38px", fontSize: "13px", padding: "0 8px" }}
                >
                  <MessageCircle size={14} />
                  {t("messageBtn")}
                </button>
                {!isEmployer && (
                  <button
                    onClick={() => onCreateMatch(activeItem)}
                    className={isMatched(activeItem) ? "secondary" : "primary"}
                    disabled={isMatched(activeItem)}
                    style={{ flex: 1.5, minHeight: "38px", fontSize: "13px" }}
                  >
                    {isMatched(activeItem) ? `✓ ${t("applied")}` : t("applyBtn")}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </section>

      {/* Native dialog modal for posting job */}
      <dialog ref={dialogRef} className="modal" style={{ padding: 0 }}>
        <div className="modal-body">
          <button className="close" onClick={() => dialogRef.current?.close()}>&times;</button>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "bold", marginBottom: "8px" }}>{t("postJobTitle")}</h2>
          <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
            {t("postJobSubtitle")}
          </p>
          <form onSubmit={handlePostJob} className="quick-form" style={{ background: "none", padding: 0, margin: 0 }}>
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>{t("jobTitleLabel")}</span>
              <input required value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder={t("jobTitlePlaceholder")} />
            </label>
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>{t("categoryLabel")}</span>
              <select value={jobCat} onChange={e => setJobCat(e.target.value)}>
                <option value="restauracao">{t("catRestauracao")}</option>
                <option value="eventos">{t("catEventos")}</option>
                <option value="logistica">{t("catLogistica")}</option>
                <option value="casa">{t("catCasa")}</option>
                <option value="retalho">{t("catRetalho")}</option>
              </select>
            </label>
            <div className="form-grid" style={{ marginBottom: "10px" }}>
              <label className="form-row">
                <span>{t("payLabel")}</span>
                <input required type="number" min="5" value={jobPay} onChange={e => setJobPay(Number(e.target.value))} />
              </label>
              <label className="form-row">
                <span>{t("durationLabel")}</span>
                <input required value={jobDuration} onChange={e => setJobDuration(e.target.value)} placeholder={t("durationPlaceholder")} />
              </label>
            </div>
            <div className="form-grid" style={{ marginBottom: "10px" }}>
              <label className="form-row">
                <span>{t("workDayLabel")}</span>
                <input type="date" required value={jobWorkDate} min={new Date().toISOString().split("T")[0]} onChange={e => setJobWorkDate(e.target.value)} />
              </label>
            </div>

            {/* Exact address */}
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>{t("addressLabel")}</span>
              <input required value={jobAddress} onChange={e => setJobAddress(e.target.value)} placeholder={t("addressPlaceholder")} />
            </label>

            {/* Photo upload with preview */}
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>{t("photoLabel")}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      if (typeof reader.result === "string") {
                        setJobPhoto(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {jobPhoto && (
                <div style={{ marginTop: "8px", position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)" }}>
                  <img src={jobPhoto} alt={jobTitle} style={{ width: "100%", maxHeight: "120px", objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => setJobPhoto("")}
                    style={{ position: "absolute", top: "5px", right: "5px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    &times;
                  </button>
                </div>
              )}
            </label>

            <label className="form-row" style={{ marginBottom: "16px" }}>
              <span>{t("taskDescLabel")}</span>
              <textarea required value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder={t("taskDescPlaceholder")} />
            </label>

            <button className="primary full" type="submit" disabled={geocoding}>
              {geocoding ? t("geocodingAddress") : t("postJobBtn")}
            </button>
          </form>
        </div>
      </dialog>

      {/* Premium custom Toast notification */}
      {toast && (
        <div className="toast" style={{ display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle size={18} color="var(--yellow)" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}
