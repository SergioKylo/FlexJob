import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Plus, Search, MapPin, DollarSign, Clock, Star, CheckCircle, Navigation, X, MessageCircle } from "lucide-react";
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

function MapClickHandler({ onClick, enabled }: { onClick: (latlng: L.LatLng) => void; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onClick(e.latlng);
      }
    },
  });
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

  // Worker - Availability Flow
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [isPlacingAvailabilityPin, setIsPlacingAvailabilityPin] = useState(false);
  const [availLat, setAvailLat] = useState<number>(user.lat ?? 38.7223);
  const [availLng, setAvailLng] = useState<number>(user.lng ?? -9.1393);
  const [availRadius, setAvailRadius] = useState(5);
  const [availRate, setAvailRate] = useState(10);
  const [availStart, setAvailStart] = useState("09:00");
  const [availEnd, setAvailEnd] = useState("18:00");
  const [availActive, setAvailActive] = useState(true);

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
    // Load worker availability details if user is worker
    if (user.role === "worker") {
      api.getWorkers(user.lat, user.lng)
        .then((list) => {
          const mine = list.find((w) => w.id === user.id);
          if (mine) {
            setAvailLat(mine.lat);
            setAvailLng(mine.lng);
            setAvailRadius(mine.hours);
            setAvailRate(mine.pay);
            setAvailActive(true);
            if (mine.time.includes(" - ")) {
              const [start, end] = mine.time.split(" - ");
              setAvailStart(start);
              setAvailEnd(end);
            }
          }
        })
        .catch(err => console.error(err));
    }
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

  const activeItem = filtered.find((item) => item.id === activeId) ?? filtered[0] ?? null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function isMatched(item: Opportunity) {
    return matches.some((match) => match.itemId === item.id && match.mode === effectiveMode);
  }

  // Handle map click (strictly for Worker availability pin location placement)
  function handleMapClick(latlng: L.LatLng) {
    if (isPlacingAvailabilityPin) {
      setAvailLat(latlng.lat);
      setAvailLng(latlng.lng);
      setIsPlacingAvailabilityPin(false);
      showToast("Localização da disponibilidade selecionada!");
    }
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
          alert("Não foi possível encontrar as coordenadas exatas para esta morada. Utilizámos a sua região de registo como salvaguarda.");
        }
      } else {
        alert("O serviço de mapas público está temporariamente indisponível. Utilizámos a sua região como salvaguarda.");
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
      showToast("Vaga de trabalho publicada com sucesso!");
      
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
      alert(err.message || "Erro ao publicar a vaga.");
    } finally {
      setGeocoding(false);
    }
  }

  // Handle saving worker availability
  async function handleSaveAvailability(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateAvailability({
        lat: availLat,
        lng: availLng,
        radius: availRadius,
        startTime: availStart,
        endTime: availEnd,
        hourlyRate: availRate,
        isActive: availActive,
      });
      setShowAvailabilityForm(false);
      showToast("A sua disponibilidade foi atualizada com sucesso!");
      
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar disponibilidade.");
    }
  }

  return (
    <>
      <section className="hero-band" style={{ paddingBottom: "10px" }}>
        <div>
          <p className="eyebrow">{isEmployer ? "Painel de Empreendedor" : "Painel de Trabalhador"}</p>
          <h1>{isEmployer ? "Vagas de trabalho na sua região." : "Oportunidades em tempo real na sua área."}</h1>
        </div>
        <div className="hero-stats">
          <span><strong>{filtered.length}</strong><small>vagas disponíveis</small></span>
          <span><strong>{user.rating?.toFixed(1) ?? "5.0"}</strong><small>A minha avaliação</small></span>
          <span><strong>{user.lat ? "Focado" : "Geral"}</strong><small>{user.lat ? "Região Selecionada" : "Portugal"}</small></span>
        </div>
      </section>

      {/* Placing pin banners */}
      <div style={{ position: "relative", width: "100%", height: 0, zIndex: 1000 }}>
        {isPlacingAvailabilityPin && (
          <div style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--green)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "20px",
            fontWeight: "bold",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontSize: "0.95rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <Navigation size={18} />
            <span>📍 Clique no mapa para definir onde quer trabalhar</span>
          </div>
        )}
      </div>

      <section className="workspace">
        <aside className="control-panel">
          {/* User Specific Quick Controls */}
          {isEmployer ? (
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button 
                className="primary full" 
                onClick={() => dialogRef.current?.showModal()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "var(--yellow)", color: "#181506" }}
              >
                <Plus size={18} />
                Publicar Vaga
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button 
                className="secondary full" 
                onClick={() => setShowAvailabilityForm(!showAvailabilityForm)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: showAvailabilityForm ? "var(--ink)" : "var(--surface)", color: showAvailabilityForm ? "white" : "var(--ink)" }}
              >
                <Clock size={18} />
                {showAvailabilityForm ? "Ver Mapa e Vagas" : "Definir a Minha Disponibilidade"}
              </button>
            </div>
          )}

          {/* Form to configure worker availability */}
          {!isEmployer && showAvailabilityForm ? (
            <form onSubmit={handleSaveAvailability} className="quick-form" style={{ background: "var(--surface)", padding: "16px", border: "1px solid var(--line)" }}>
              <h3>Definir Minha Disponibilidade</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>
                Os empreendedores poderão ver a sua localização e nota média no mapa.
              </p>
              
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <button 
                  type="button" 
                  className="secondary small full" 
                  onClick={() => setIsPlacingAvailabilityPin(true)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <MapPin size={16} />
                  {isPlacingAvailabilityPin ? "Aguardando clique..." : "Selecionar Posição no Mapa"}
                </button>
              </div>

              <div className="form-grid">
                <label className="form-row">
                  <span>Preço Base (EUR/h)</span>
                  <input required type="number" value={availRate} onChange={e => setAvailRate(Number(e.target.value))} />
                </label>
                <label className="form-row">
                  <span>Raio de Ação (km)</span>
                  <input required type="number" value={availRadius} onChange={e => setAvailRadius(Number(e.target.value))} />
                </label>
              </div>

              <div className="form-grid" style={{ marginTop: "10px" }}>
                <label className="form-row">
                  <span>Hora Início</span>
                  <input type="time" value={availStart} onChange={e => setAvailStart(e.target.value)} />
                </label>
                <label className="form-row">
                  <span>Hora Fim</span>
                  <input type="time" value={availEnd} onChange={e => setAvailEnd(e.target.value)} />
                </label>
              </div>

              <label className="form-row" style={{ flexDirection: "row", alignItems: "center", gap: "8px", marginTop: "14px" }}>
                <input type="checkbox" checked={availActive} onChange={e => setAvailActive(e.target.checked)} style={{ width: "20px", height: "20px" }} />
                <span>Estou ativo e disponível para trabalhar hoje</span>
              </label>

              <button className="primary full" type="submit" style={{ marginTop: "16px" }}>Gravar Configurações</button>
            </form>
          ) : (
            <>
              {/* Search and Filters */}
              <div className="search-box">
                <Search size={18} style={{ color: "var(--muted)" }} />
                <input placeholder={t("search")} value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>

              <div className="filters">
                {["all", "restauracao", "eventos", "logistica", "casa", "retalho"].map((item) => (
                  <button className={`chip ${category === item ? "active" : ""}`} key={item} onClick={() => setCategory(item)}>
                    {item === "all" ? t("all") : t(item as TranslationKey)}
                  </button>
                ))}
              </div>

              <div className="sort-row">
                <label>{t("sortBy")}</label>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                  <option value="match">{t("bestMatch")}</option>
                  <option value="pay">{t("highestPay")}</option>
                  <option value="distance">{t("nearest")}</option>
                  <option value="rating">{t("bestRating")}</option>
                </select>
              </div>

              <div className="job-list" style={{ flex: 1 }}>
                {loading && <div style={{ textAlign: "center", padding: "20px", fontWeight: "bold" }}>A carregar...</div>}
                {!loading && filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 10px" }}>
                    Nenhum registo encontrado na sua área de residência.
                  </div>
                )}
                {filtered.map((item) => (
                  <article className={`job-card ${activeItem?.id === item.id ? "active" : ""} ${isMatched(item) ? "matched" : ""}`} key={item.id} onClick={() => setActiveId(item.id)}>
                    <div className="job-meta">
                      <span className="tag">{t(item.type)}</span>
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
                        <span>{item.rating.toFixed(1)} Classificação</span>
                      </span>
                      {!isEmployer && (
                        <button onClick={(event) => { event.stopPropagation(); onCreateMatch(item); }}>
                          {isMatched(item) ? "Candidatado" : t("apply")}
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
            <MapClickHandler onClick={handleMapClick} enabled={isPlacingAvailabilityPin} />

            {/* Display list items */}
            {filtered.map((item) => (
              <Marker 
                eventHandlers={{ click: () => setActiveId(item.id) }} 
                icon={iconFor(item, effectiveMode, activeItem?.id === item.id)} 
                key={item.id} 
                position={[item.lat, item.lng]} 
              />
            ))}

            {/* Display worker's own availability pin if editing availability */}
            {!isEmployer && (
              <Marker 
                position={[availLat, availLng]}
                icon={L.divIcon({
                  className: "flex-marker active",
                  html: `<span>AQUI</span>`,
                  iconSize: [46, 46],
                  iconAnchor: [23, 41]
                })}
              />
            )}
          </MapContainer>

          {activeItem && (
            <div className="map-detail" style={{ maxHeight: "420px", overflowY: "auto" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="tag" style={{ marginBottom: "6px", display: "inline-block" }}>
                    {t(activeItem.type)}
                  </span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "700", margin: "4px 0 2px", color: "var(--ink)", lineHeight: 1.2 }}>
                    {activeItem.title}
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                    Por {activeItem.requester}
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
                <h4 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: "6px" }}>Descrição</h4>
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
                  Mensagem
                </button>
                {!isEmployer && (
                  <button
                    onClick={() => onCreateMatch(activeItem)}
                    className={isMatched(activeItem) ? "secondary" : "primary"}
                    disabled={isMatched(activeItem)}
                    style={{ flex: 1.5, minHeight: "38px", fontSize: "13px" }}
                  >
                    {isMatched(activeItem) ? "✓ Candidatado" : "Candidatar-se"}
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
          <h2 style={{ fontSize: "1.4rem", fontWeight: "bold", marginBottom: "8px" }}>Publicar Nova Vaga de Trabalho</h2>
          <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
            Insira os detalhes e morada do trabalho a ser realizado. Nós iremos localizá-lo automaticamente no mapa.
          </p>
          <form onSubmit={handlePostJob} className="quick-form" style={{ background: "none", padding: 0, margin: 0 }}>
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>Título do Trabalho</span>
              <input required value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Ex: Ajudante de Cozinha, Limpeza Geral" />
            </label>
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>Categoria</span>
              <select value={jobCat} onChange={e => setJobCat(e.target.value)}>
                <option value="restauracao">Restauração</option>
                <option value="eventos">Eventos</option>
                <option value="logistica">Logística</option>
                <option value="casa">Serviços Domésticos</option>
                <option value="retalho">Retalho / Lojas</option>
              </select>
            </label>
            <div className="form-grid" style={{ marginBottom: "10px" }}>
              <label className="form-row">
                <span>Pagamento (EUR/h)</span>
                <input required type="number" min="5" value={jobPay} onChange={e => setJobPay(Number(e.target.value))} />
              </label>
              <label className="form-row">
                <span>Duração Estimada</span>
                <input required value={jobDuration} onChange={e => setJobDuration(e.target.value)} placeholder="Ex: 4 horas, 2 dias" />
              </label>
            </div>
            <div className="form-grid" style={{ marginBottom: "10px" }}>
              <label className="form-row">
                <span>Dia do trabalho</span>
                <input type="date" required value={jobWorkDate} min={new Date().toISOString().split("T")[0]} onChange={e => setJobWorkDate(e.target.value)} />
              </label>
            </div>
            
            {/* Morada Exata */}
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>Morada Exata do Trabalho</span>
              <input required value={jobAddress} onChange={e => setJobAddress(e.target.value)} placeholder="Ex: Avenida dos Aliados, Porto" />
            </label>

            {/* Foto upload with preview */}
            <label className="form-row" style={{ marginBottom: "10px" }}>
              <span>Foto do Local/Trabalho (Opcional)</span>
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
                  <img src={jobPhoto} alt="Trabalho" style={{ width: "100%", maxHeight: "120px", objectFit: "cover" }} />
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
              <span>Descrição das Tarefas</span>
              <textarea required value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Descreva claramente o que o trabalhador precisará fazer..." />
            </label>
            
            <button className="primary full" type="submit" disabled={geocoding}>
              {geocoding ? "A geocodificar morada..." : "Publicar Vaga de Trabalho"}
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

