import { useState, useEffect } from "react";
import { Star, MessageSquare, Search, MapPin, X } from "lucide-react";
import type { Opportunity, User } from "../types";
import { api } from "../utils/api";

type WorkersPageProps = {
  workers: Opportunity[];
  t: (key: any) => string;
  user: User;
  onStartChat: (partnerId: number, partnerName: string, partnerAvatar?: string) => void;
};

type Review = {
  id: number;
  rating: number;
  comment: string;
  reviewer_name: string;
  reviewer_avatar?: string;
  created_at: string;
};

export function WorkersPage({ workers, user, onStartChat }: WorkersPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"rating" | "pay" | "distance">("rating");
  const [selectedWorker, setSelectedWorker] = useState<Opportunity | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    if (selectedWorker) {
      setLoadingReviews(true);
      api.getReviews(selectedWorker.id)
        .then((data) => {
          setReviews(data);
          setLoadingReviews(false);
        })
        .catch((err) => {
          console.error("Error fetching reviews:", err);
          setLoadingReviews(false);
        });
    }
  }, [selectedWorker]);

  const filteredWorkers = workers
    .filter((w) => {
      const matchName = w.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBio = w.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchName || matchBio;
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "pay") return a.pay - b.pay; // lower price first
      if (sortBy === "distance") return a.distance - b.distance;
      return 0;
    });

  return (
    <section className="screen" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div className="screen-head" style={{ marginBottom: "2rem" }}>
        <div>
          <p className="eyebrow" style={{ color: "#6366f1", letterSpacing: "1px", textTransform: "uppercase" }}>Empreendedores</p>
          <h2 style={{ fontSize: "2rem", fontWeight: "700", color: "#fff" }}>Encontre Trabalhadores Qualificados</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: "0.5rem" }}>Disponíveis na sua região geográfica. Veja classificações e envie mensagens diretas.</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="filters-bar" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            placeholder="Pesquisar por nome ou bio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.75rem 0.75rem 0.75rem 2.5rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "0.95rem" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", outline: "none", cursor: "pointer" }}
          >
            <option value="rating" style={{ background: "#2e2e2e" }}>Melhor Classificação</option>
            <option value="pay" style={{ background: "#2e2e2e" }}>Menor Tarifa Horária</option>
            <option value="distance" style={{ background: "#2e2e2e" }}>Mais Próximo</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="workers-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {filteredWorkers.map((worker) => (
          <article
            key={worker.id}
            onClick={() => setSelectedWorker(worker)}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "1.5rem",
              cursor: "pointer",
              transition: "transform 0.2s, border-color 0.2s",
              position: "relative",
              overflow: "hidden"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${worker.title}`}
                alt={worker.title}
                style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", padding: "2px" }}
              />
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: "600", color: "#fff", margin: 0 }}>{worker.title}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#f59e0b", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                  <Star size={14} fill="#f59e0b" />
                  <span>{worker.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", height: "3rem", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", margin: "1rem 0" }}>
              {worker.description}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem", marginTop: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <MapPin size={12} /> {worker.distance} km
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#6366f1" }}>
                €{worker.pay}/h
              </span>
            </div>
          </article>
        ))}

        {filteredWorkers.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px" }}>
            <p style={{ color: "rgba(255,255,255,0.5)" }}>Nenhum trabalhador disponível com os filtros atuais.</p>
          </div>
        )}
      </div>

      {/* Side Detail Modal */}
      {selectedWorker && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: "450px", height: "100%", background: "#1f1f1f", borderLeft: "1px solid rgba(255,255,255,0.1)", padding: "2.5rem 2rem", overflowY: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
            <button
              onClick={() => setSelectedWorker(null)}
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", borderRadius: "50%", padding: "0.5rem", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedWorker.title}`}
                alt={selectedWorker.title}
                style={{ width: "90px", height: "90px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", margin: "0 auto 1rem", border: "2px solid #6366f1", padding: "4px" }}
              />
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#fff", marginBottom: "0.25rem" }}>{selectedWorker.title}</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", color: "#f59e0b", fontSize: "1.1rem" }}>
                <Star size={18} fill="#f59e0b" />
                <strong>{selectedWorker.rating.toFixed(1)}</strong>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Disponível na sua região ({selectedWorker.distance} km de distância)
              </p>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", marginBottom: "0.5rem" }}>Bio / Perfil</h3>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.95rem", lineHeight: "1.6", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                {selectedWorker.description}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                <small style={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Tarifa Horária</small>
                <strong style={{ fontSize: "1.2rem", color: "#6366f1" }}>€{selectedWorker.pay}/h</strong>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                <small style={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Horário Base</small>
                <strong style={{ fontSize: "0.95rem", color: "#fff", display: "block", marginTop: "0.2rem" }}>{selectedWorker.time}</strong>
              </div>
            </div>

            <button
              onClick={() => {
                onStartChat(selectedWorker.id, selectedWorker.title);
                setSelectedWorker(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                width: "100%",
                padding: "1rem",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
                transition: "opacity 0.2s",
                marginBottom: "2.5rem"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              <MessageSquare size={18} />
              Enviar Mensagem Direta
            </button>

            <div>
              <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", marginBottom: "1rem" }}>Avaliações Recentes</h3>
              {loadingReviews ? (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>A carregar avaliações...</p>
              ) : reviews.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>Ainda não tem avaliações de outros empreendedores.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {reviews.map((rev) => (
                    <div key={rev.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.85rem" }}>{rev.reviewer_name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#f59e0b", fontSize: "0.8rem" }}>
                          <Star size={12} fill="#f59e0b" />
                          <span>{rev.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", margin: 0, lineHeight: "1.4" }}>{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
