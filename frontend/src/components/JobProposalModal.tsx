import { useEffect, useState } from "react";
import { X, Briefcase, Send, CheckCircle } from "lucide-react";
import { api } from "../utils/api";
import type { User } from "../types";

interface JobProposalModalProps {
  workerId: number;
  workerName: string;
  currentUser: User;
  onClose: () => void;
  /** Called with jobId after proposal is sent */
  onSent?: (jobId: number) => void;
}

type Tab = "new" | "existing";

interface MyJob {
  id: number;
  title: string;
  pay: number;
  city: string;
  status: string;
}

export function JobProposalModal({ workerId, workerName, currentUser, onClose, onSent }: JobProposalModalProps) {
  const [tab, setTab] = useState<Tab>("new");
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // New-proposal form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pay, setPay] = useState<number>(12);
  const [duration, setDuration] = useState("4h");
  const [workDate, setWorkDate] = useState(new Date().toISOString().split("T")[0]);
  const [address, setAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingJobs(true);
    api.getMyJobs()
      .then((jobs) => {
        const open = jobs
          .filter((j: any) => j.status === "open")
          .map((j: any) => ({ id: j.id, title: j.title, pay: j.pay, city: j.address || j.city || "", status: j.status }));
        setMyJobs(open);
        setLoadingJobs(false);
      })
      .catch(() => setLoadingJobs(false));
  }, []);

  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.proposeJob({
        workerId,
        title: title.trim(),
        description: description.trim(),
        pay,
        duration,
        workDate,
        address: address.trim() || undefined,
      });
      setSent(true);
      onSent?.(res.jobId);
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar proposta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitExisting(jobId: number) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.proposeJob({ workerId, existingJobId: jobId, pay: 0 });
      setSent(true);
      onSent?.(res.jobId);
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar proposta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }}>
      <div style={{
        width: "100%", maxWidth: "460px", background: "var(--surface)",
        border: "1px solid var(--line)", borderRadius: "20px",
        boxShadow: "var(--shadow)", display: "flex", flexDirection: "column",
        maxHeight: "85vh", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--ink)" }}>
              💼 Propor Trabalho
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>para {workerName}</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)" }}>
            <X size={16} />
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: "12px" }}>
            <CheckCircle size={52} style={{ color: "var(--green)" }} />
            <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)" }}>Proposta enviada!</h4>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", textAlign: "center" }}>
              {workerName} vai receber a proposta no chat. Aguarda a resposta.
            </p>
            <button onClick={onClose} style={{ marginTop: 8, padding: "10px 28px", borderRadius: "12px", border: "none", background: "var(--yellow)", color: "#181506", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div style={{ display: "flex", padding: "12px 20px 0", gap: "6px" }}>
              {([["new", "✏️ Nova proposta"], ["existing", "📋 Vaga existente"]] as [Tab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: "10px", border: "none", cursor: "pointer",
                    fontWeight: 700, fontSize: "13px",
                    background: tab === key ? "var(--yellow)" : "var(--surface2)",
                    color: tab === key ? "#181506" : "var(--muted)",
                    transition: "all 0.15s",
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
              {error && (
                <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "13px" }}>
                  {error}
                </div>
              )}

              {tab === "new" ? (
                <form onSubmit={handleSubmitNew} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Título *</span>
                    <input required value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Ajudante de Cozinha"
                      style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: "14px", outline: "none" }} />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Descrição</span>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detalhes do trabalho a realizar..."
                      rows={3}
                      style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", resize: "none", fontFamily: "inherit" }} />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Pagamento €/h</span>
                      <input type="number" min={5} step={0.5} required value={pay} onChange={(e) => setPay(Number(e.target.value))}
                        style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: "14px", outline: "none" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Duração</span>
                      <input value={duration} onChange={(e) => setDuration(e.target.value)}
                        placeholder="Ex: 4h, 2 dias"
                        style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: "14px", outline: "none" }} />
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Data</span>
                      <input type="date" value={workDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setWorkDate(e.target.value)}
                        style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Local</span>
                      <input value={address} onChange={(e) => setAddress(e.target.value)}
                        placeholder="Morada ou local"
                        style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: "14px", outline: "none" }} />
                    </label>
                  </div>

                  <button type="submit" disabled={submitting || !title.trim()}
                    style={{
                      marginTop: "4px", padding: "12px", borderRadius: "12px", border: "none", cursor: "pointer",
                      background: "var(--yellow)", color: "#181506", fontWeight: 800, fontSize: "15px",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      opacity: submitting || !title.trim() ? 0.55 : 1, transition: "opacity 0.15s",
                    }}>
                    <Send size={16} />
                    {submitting ? "A enviar..." : "Enviar Proposta"}
                  </button>
                </form>
              ) : (
                /* Existing jobs tab */
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", color: "var(--muted)" }}>
                    Seleciona uma das tuas vagas abertas para propor diretamente a {workerName}:
                  </p>
                  {loadingJobs ? (
                    <p style={{ color: "var(--muted)", fontSize: "13px" }}>A carregar vagas...</p>
                  ) : myJobs.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "12px" }}>
                      <Briefcase size={32} style={{ color: "var(--muted)", opacity: 0.4, marginBottom: "8px" }} />
                      <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>Não tens vagas abertas de momento.</p>
                      <button onClick={() => setTab("new")} style={{ marginTop: "10px", padding: "7px 16px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", cursor: "pointer" }}>
                        Criar nova proposta
                      </button>
                    </div>
                  ) : (
                    myJobs.map((job) => (
                      <button key={job.id} onClick={() => handleSubmitExisting(job.id)} disabled={submitting}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px",
                          borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface2)",
                          cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
                          opacity: submitting ? 0.55 : 1,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--yellow)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                      >
                        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(255,210,51,0.15)", border: "1px solid rgba(255,210,51,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Briefcase size={18} style={{ color: "var(--yellow)" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</p>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>€{job.pay}/h · {job.city}</p>
                        </div>
                        <Send size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
