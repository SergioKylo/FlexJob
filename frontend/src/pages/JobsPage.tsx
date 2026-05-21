import { useState } from "react";
import { Star, MessageSquare, Search, MapPin, X, Briefcase, FileImage } from "lucide-react";
import type { Opportunity, MatchRecord } from "../types";

type JobsPageProps = {
  needs: Opportunity[];
  matches: MatchRecord[];
  t: (key: any) => string;
  onCreateMatch: (item: Opportunity) => void;
  onStartChat: (partnerId: number, partnerName: string, partnerAvatar?: string, jobId?: number) => void;
};

export function JobsPage({ needs, matches, onCreateMatch, onStartChat }: JobsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Opportunity | null>(null);

  const categories = [
    { value: "all", label: "Todas" },
    { value: "restauracao", label: "Restauração" },
    { value: "eventos", label: "Eventos" },
    { value: "logistica", label: "Logística" },
    { value: "casa", label: "Casa" },
    { value: "retalho", label: "Retalho" }
  ];

  const filteredJobs = needs.filter((job) => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.requester.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || job.type === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <section className="screen" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div className="screen-head" style={{ marginBottom: "2rem" }}>
        <div>
          <p className="eyebrow" style={{ color: "#6366f1", letterSpacing: "1px", textTransform: "uppercase" }}>Trabalhadores</p>
          <h2 style={{ fontSize: "2rem", fontWeight: "700", color: "#fff" }}>Oportunidades de Trabalho Flexível</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: "0.5rem" }}>Disponíveis na sua região de Portugal. Candidate-se e fale diretamente com o empregador.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            placeholder="Pesquisar por título, empresa ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.75rem 0.75rem 0.75rem 2.5rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "0.95rem" }}
          />
        </div>
        
        {/* Category Pills */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                border: selectedCategory === cat.value ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                background: selectedCategory === cat.value ? "#6366f1" : "rgba(255,255,255,0.05)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.85rem",
                transition: "background 0.2s, border-color 0.2s"
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="jobs-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {filteredJobs.map((job) => {
          const alreadyApplied = matches.some((m) => m.itemId === job.id);
          
          return (
            <article
              key={job.id}
              onClick={() => setSelectedJob(job)}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "1.5rem",
                cursor: "pointer",
                transition: "transform 0.2s, border-color 0.2s",
                display: "flex",
                flexDirection: "column",
                height: "100%",
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
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${job.requester}`}
                  alt={job.requester}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", padding: "2px" }}
                />
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>{job.requester}</h4>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#fff", margin: "2px 0 0" }}>{job.title}</h3>
                </div>
                {alreadyApplied && (
                  <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "0.25rem 0.5rem", borderRadius: "12px", fontWeight: "bold" }}>
                    Candidatado
                  </span>
                )}
              </div>

              {job.photo && (
                <div style={{ width: "100%", height: "140px", borderRadius: "8px", overflow: "hidden", marginBottom: "1rem", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <img src={job.photo} alt={job.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", flex: 1, margin: "0 0 1rem", lineHeight: "1.5", height: "3rem", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {job.description}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem" }}>
                <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <MapPin size={12} /> {job.city || "Local"} ({job.distance} km)
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#6366f1" }}>
                  €{job.pay}/h
                </span>
              </div>
            </article>
          );
        })}

        {filteredJobs.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px" }}>
            <p style={{ color: "rgba(255,255,255,0.5)" }}>Nenhuma vaga de trabalho encontrada com os filtros atuais.</p>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: "480px", height: "100%", background: "#1f1f1f", borderLeft: "1px solid rgba(255,255,255,0.1)", padding: "2.5rem 2rem", overflowY: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
            <button
              onClick={() => setSelectedJob(null)}
              style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", borderRadius: "50%", padding: "0.5rem", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedJob.requester}`}
                alt={selectedJob.requester}
                style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", padding: "2px" }}
              />
              <div>
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>{selectedJob.requester}</span>
                <h2 style={{ fontSize: "1.35rem", fontWeight: "bold", color: "#fff", margin: 0 }}>{selectedJob.title}</h2>
              </div>
            </div>

            {selectedJob.photo ? (
              <div style={{ width: "100%", height: "200px", borderRadius: "12px", overflow: "hidden", marginBottom: "1.5rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src={selectedJob.photo} alt={selectedJob.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ width: "100%", height: "120px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", marginBottom: "1.5rem" }}>
                <FileImage size={32} style={{ marginBottom: "0.5rem" }} />
                <span style={{ fontSize: "0.85rem" }}>Sem foto anexada</span>
              </div>
            )}

            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "0.95rem", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", marginBottom: "0.5rem" }}>Descrição da Vaga</h3>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.95rem", lineHeight: "1.6", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", whiteSpace: "pre-wrap" }}>
                {selectedJob.description}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                <small style={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Pagamento Proposto</small>
                <strong style={{ fontSize: "1.2rem", color: "#6366f1" }}>€{selectedJob.pay}/h</strong>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                <small style={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Duração Estimada</small>
                <strong style={{ fontSize: "1rem", color: "#fff", display: "block", marginTop: "0.2rem" }}>{selectedJob.time}</strong>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", marginBottom: "2.5rem", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <MapPin size={16} style={{ color: "#6366f1", flexShrink: 0 }} />
              <div>
                <small style={{ color: "rgba(255,255,255,0.4)", display: "block" }}>Morada Exata</small>
                <span>{selectedJob.address || selectedJob.city}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {matches.some((m) => m.itemId === selectedJob.id) ? (
                <button
                  disabled
                  style={{
                    width: "100%",
                    padding: "1rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "#10b981",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "rgba(16, 185, 129, 0.3)",
                    textAlign: "center"
                  }}
                >
                  Candidatura Efetuada
                </button>
              ) : (
                <button
                  onClick={() => {
                    onCreateMatch(selectedJob);
                    setSelectedJob(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
                    transition: "opacity 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Candidatar-se a Vaga
                </button>
              )}

              <button
                onClick={() => {
                  onStartChat(selectedJob.employerId!, selectedJob.requester, `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedJob.requester}`, selectedJob.id);
                  setSelectedJob(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  width: "100%",
                  padding: "1rem",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              >
                <MessageSquare size={18} />
                Enviar Mensagem ao Empregador
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
