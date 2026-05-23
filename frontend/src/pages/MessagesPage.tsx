import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ArrowLeft, Briefcase, Clock, Lock, CheckCircle, AlertCircle, Star, CreditCard, X } from "lucide-react";
import { api } from "../utils/api";
import type { ChatMessage, InboxConversation, User } from "../types";

type JobDetail = {
  id: number;
  title: string;
  pay: number;
  duration: string;
  status: string;
  paymentStatus: string;
  employerId: number;
  employerName: string;
  workerId?: number;
  workerName?: string;
};

type MessagesPageProps = {
  user: User;
  initialPartnerId?: number;
  initialPartnerName?: string;
  initialPartnerAvatar?: string;
  initialJobId?: number;
};

export function MessagesPage({
  user,
  initialPartnerId,
  initialPartnerName,
  initialPartnerAvatar,
  initialJobId,
}: MessagesPageProps) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [selectedConv, setSelectedConv] = useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payHours, setPayHours] = useState(1);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");
  const [showTipForm, setShowTipForm] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipLoading, setTipLoading] = useState(false);
  const [showWorkerReview, setShowWorkerReview] = useState(false);
  const [workerReviewRating, setWorkerReviewRating] = useState(5);
  const [workerReviewComment, setWorkerReviewComment] = useState("");
  const [workerReviewLoading, setWorkerReviewLoading] = useState(false);
  const [workerReviewDone, setWorkerReviewDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Load inbox; refresh every 5s
  useEffect(() => {
    let active = true;
    async function fetchInbox() {
      try {
        const data = await api.getInbox();
        if (!active) return;
        setConversations(data);
        setLoadingInbox(false);
        if (initialPartnerId && !selectedConv) {
          const existing = data.find(
            (c) => c.partnerId === initialPartnerId && (initialJobId ? c.jobId === initialJobId : true)
          );
          if (existing) {
            setSelectedConv(existing);
          } else if (initialPartnerName) {
            setSelectedConv({
              partnerId: initialPartnerId,
              partnerName: initialPartnerName,
              partnerAvatar: initialPartnerAvatar ?? "",
              partnerRole: "",
              jobId: initialJobId ?? 0,
              jobTitle: "",
              lastMessage: "",
              lastMessageTime: new Date().toISOString(),
            });
          }
        }
      } catch {
        if (active) setLoadingInbox(false);
      }
    }
    fetchInbox();
    const interval = setInterval(fetchInbox, 5000);
    return () => { active = false; clearInterval(interval); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages when conversation changes
  useEffect(() => {
    if (!selectedConv) { setMessages([]); return; }
    let active = true;
    setLoadingMessages(true);
    const jobId = selectedConv.jobId > 0 ? selectedConv.jobId : undefined;

    async function fetchMessages() {
      try {
        const data = await api.getMessages(selectedConv!.partnerId, jobId);
        if (active) { setMessages(data); setLoadingMessages(false); }
      } catch {
        if (active) setLoadingMessages(false);
      }
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [selectedConv?.partnerId, selectedConv?.jobId]);

  // Fetch job details when a job conversation is selected
  useEffect(() => {
    setJobDetail(null);
    setShowRatingForm(false);
    setShowPayForm(false);
    setShowTipForm(false);
    setShowWorkerReview(false);
    setWorkerReviewDone(false);
    setWorkerReviewComment("");
    if (selectedConv && selectedConv.jobId > 0) {
      api.getJobDetail(selectedConv.jobId)
        .then(setJobDetail)
        .catch(() => setJobDetail(null));
    }
  }, [selectedConv?.jobId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv) return;
    const content = inputText.trim();
    setInputText("");
    try {
      const jobId = selectedConv.jobId > 0 ? selectedConv.jobId : undefined;
      await api.sendMessage(selectedConv.partnerId, content, jobId);
      const data = await api.getMessages(selectedConv.partnerId, jobId);
      setMessages(data);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  }

  async function handleEscrow() {
    if (!jobDetail) return;
    setPaymentLoading(true);
    try {
      await api.escrowPayment(jobDetail.id, payHours, payDate, payNotes);
      const updated = await api.getJobDetail(jobDetail.id);
      setJobDetail(updated);
      setShowPayForm(false);
      setPayNotes("");
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      alert(err.message || "Erro ao efetuar pagamento.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleAcceptWorker(workerId: number, accept: boolean) {
    if (!jobDetail) return;
    try {
      await api.acceptWorker(jobDetail.id, workerId, accept);
      const updated = await api.getJobDetail(jobDetail.id);
      setJobDetail(updated);
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      alert(err.message || "Erro ao responder à candidatura.");
    }
  }

  async function handleWorkerReview() {
    if (!jobDetail) return;
    setWorkerReviewLoading(true);
    try {
      await api.workerReview(jobDetail.id, workerReviewRating, workerReviewComment);
      setWorkerReviewDone(true);
      setShowWorkerReview(false);
    } catch (err: any) {
      alert(err.message || "Erro ao enviar avaliação.");
    } finally {
      setWorkerReviewLoading(false);
    }
  }

  async function handleTip() {
    if (!jobDetail) return;
    setTipLoading(true);
    try {
      await api.tipWorker(jobDetail.id, tipAmount);
      setShowTipForm(false);
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      alert(err.message || "Erro ao dar gorjeta.");
    } finally {
      setTipLoading(false);
    }
  }

  async function handleRelease() {
    if (!jobDetail) return;
    setPaymentLoading(true);
    try {
      await api.releasePayment(jobDetail.id, rating, ratingComment);
      const updated = await api.getJobDetail(jobDetail.id);
      setJobDetail(updated);
      setShowRatingForm(false);
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      alert(err.message || "Erro ao confirmar trabalho.");
    } finally {
      setPaymentLoading(false);
    }
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const diffH = (Date.now() - d.getTime()) / 3_600_000;
    if (diffH < 1) return `${Math.round(diffH * 60)} min`;
    if (diffH < 24) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  }

  const showList = !isMobile || !selectedConv;
  const showChat = !isMobile || !!selectedConv;

  const isEmployer = user.role === "employer";

  // Determine payment bar state
  const canPay = isEmployer && jobDetail && jobDetail.workerId && jobDetail.paymentStatus === "none" && jobDetail.status === "accepted";
  const awaitingConfirmation = isEmployer && jobDetail && jobDetail.paymentStatus === "escrowed";
  const workerEscrow = !isEmployer && jobDetail && jobDetail.paymentStatus === "escrowed";
  const jobDone = jobDetail && jobDetail.paymentStatus === "released";
  const showPaymentBar = !!(awaitingConfirmation || workerEscrow || jobDone);

  return (
    <div className="msg-shell">

      {/* ── Conversation list ── */}
      {showList && (
        <div className="msg-sidebar" style={{ width: isMobile ? "100%" : undefined }}>
          <div className="msg-sidebar-head">
            <h2>Mensagens</h2>
            <p>{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}</p>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingInbox ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>A carregar...</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                <MessageSquare size={40} style={{ color: "var(--line)", marginBottom: "1rem", display: "block", margin: "0 auto 1rem" }} />
                <p style={{ color: "var(--muted)", fontSize: "0.87rem", lineHeight: "1.55", margin: 0 }}>
                  Ainda não tem conversas.<br />
                  Candidate-se a vagas ou contacte trabalhadores para começar.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive =
                  selectedConv?.partnerId === conv.partnerId &&
                  selectedConv?.jobId === conv.jobId;
                return (
                  <button
                    key={`${conv.partnerId}-${conv.jobId}`}
                    onClick={() => setSelectedConv(conv)}
                    className={`msg-conv-btn ${isActive ? "active" : ""}`}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {conv.partnerAvatar ? (
                        <img src={conv.partnerAvatar} alt={conv.partnerName}
                          style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          width: "42px", height: "42px", borderRadius: "50%",
                          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: "700", color: "#fff", fontSize: "0.85rem",
                        }}>
                          {getInitials(conv.partnerName)}
                        </div>
                      )}
                      <span style={{
                        position: "absolute", bottom: "1px", right: "1px",
                        width: "9px", height: "9px", background: "#10b981",
                        borderRadius: "50%", border: "2px solid var(--surface)",
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.1rem" }}>
                        <span style={{ fontWeight: "600", color: "var(--ink)", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {conv.partnerName}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0, marginLeft: "0.5rem" }}>
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      {conv.jobTitle && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.15rem" }}>
                          <Briefcase size={9} style={{ color: "#6366f1", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.7rem", color: "#6366f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {conv.jobTitle}
                          </span>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.lastMessage || "Iniciar conversa..."}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Chat panel ── */}
      {showChat && (
        <div className="msg-chat-panel">
          {selectedConv ? (
            <>
              {/* Chat header */}
              <div className="msg-chat-header">
                {isMobile && (
                  <button onClick={() => setSelectedConv(null)}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "0.25rem", display: "flex" }}>
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: "700", color: "#fff", fontSize: "0.82rem", flexShrink: 0,
                }}>
                  {getInitials(selectedConv.partnerName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: "700", color: "var(--ink)" }}>
                    {selectedConv.partnerName}
                  </h3>
                  {selectedConv.jobTitle && (
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#6366f1", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Briefcase size={9} />
                      {selectedConv.jobTitle}
                    </p>
                  )}
                </div>
                {selectedConv.partnerRole && (
                  <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                    <Clock size={10} />
                    {selectedConv.partnerRole}
                  </span>
                )}
                {canPay && (
                  <button
                    onClick={() => setShowPayForm((v) => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.35rem",
                      padding: "0.4rem 0.8rem", borderRadius: "10px", border: "none",
                      background: showPayForm ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "linear-gradient(135deg, #22c97a, #16a361)",
                      color: "#fff", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer",
                      flexShrink: 0, transition: "background 0.15s",
                    }}
                  >
                    <CreditCard size={14} />
                    Pagar antecipadamente
                  </button>
                )}
              </div>

              {/* ── Payment form panel ── */}
              {showPayForm && canPay && (
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", background: "var(--surface2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "var(--ink)" }}>
                      💳 Depositar pagamento em garantia
                    </h4>
                    <button onClick={() => setShowPayForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.2rem" }}>
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Horas</span>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={payHours}
                        onChange={(e) => setPayHours(parseFloat(e.target.value) || 1)}
                        className="msg-input"
                        style={{ padding: "0.5rem 0.7rem" }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Data do trabalho</span>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="msg-input"
                        style={{ padding: "0.5rem 0.7rem" }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.8rem", borderRadius: "8px", background: "rgba(34,201,122,0.08)", border: "1px solid rgba(34,201,122,0.2)", marginBottom: "0.6rem" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{payHours}h × €{jobDetail!.pay.toFixed(2)}/h =</span>
                    <strong style={{ fontSize: "1.1rem", color: "#22c97a" }}>€{(payHours * jobDetail!.pay).toFixed(2)}</strong>
                  </div>
                  <input
                    type="text"
                    placeholder="Notas para o trabalhador (opcional)..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="msg-input"
                    style={{ width: "100%", boxSizing: "border-box", marginBottom: "0.6rem", padding: "0.5rem 0.7rem" }}
                  />
                  <button
                    onClick={handleEscrow}
                    disabled={paymentLoading}
                    style={{
                      width: "100%", padding: "0.65rem", borderRadius: "10px", border: "none",
                      background: "linear-gradient(135deg, #22c97a, #16a361)", color: "#fff",
                      fontWeight: "700", fontSize: "0.88rem", cursor: "pointer",
                      opacity: paymentLoading ? 0.6 : 1,
                    }}
                  >
                    {paymentLoading ? "A processar..." : `💳 Pagar Antecipadamente €${(payHours * jobDetail!.pay).toFixed(2)}`}
                  </button>
                </div>
              )}

              {/* Messages area */}
              <div className="msg-chat-area">
                {loadingMessages && messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                    A carregar mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", textAlign: "center", gap: "0.75rem", padding: "2rem" }}>
                    <MessageSquare size={44} style={{ opacity: 0.25 }} />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>
                      Inicie a conversa com {selectedConv.partnerName}!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      userId={user.id ?? 0}
                      onAcceptWorker={isEmployer && jobDetail?.status === "open" ? handleAcceptWorker : undefined}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Payment action bar ── */}
              {showPaymentBar && (
                <div className="msg-payment-bar">
                  {jobDone && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.9rem", borderRadius: "10px", background: "rgba(34,201,122,0.1)", border: "1px solid rgba(34,201,122,0.25)", color: "var(--green)" }}>
                        <CheckCircle size={16} />
                        <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>Trabalho concluído · €{jobDetail!.pay.toFixed(2)} pagos</span>
                      </div>
                      {isEmployer && (
                        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "0.6rem", marginTop: "0.2rem" }}>
                          {!showTipForm ? (
                            <button
                              onClick={() => setShowTipForm(true)}
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                            >
                              🎁 Dar Gorjeta ao Trabalhador
                            </button>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: "600", textTransform: "uppercase" }}>Valor da gorjeta (€)</span>
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={tipAmount}
                                onChange={(e) => setTipAmount(parseFloat(e.target.value) || 5)}
                                className="msg-input"
                                style={{ padding: "0.5rem 0.7rem" }}
                              />
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                  onClick={() => setShowTipForm(false)}
                                  style={{ flex: 1, padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem" }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleTip}
                                  disabled={tipLoading}
                                  style={{ flex: 2, padding: "0.5rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", opacity: tipLoading ? 0.6 : 1 }}
                                >
                                  {tipLoading ? "A enviar..." : `Dar €${tipAmount.toFixed(2)} de Gorjeta 🎁`}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {workerEscrow && !jobDone && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.9rem", borderRadius: "10px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#6366f1" }}>
                      <CreditCard size={16} />
                      <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>💳 Pagamento recebido antecipadamente — aguarda confirmação após o trabalho</span>
                    </div>
                  )}
                  {awaitingConfirmation && !jobDone && !isEmployer && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.9rem", borderRadius: "10px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#6366f1" }}>
                      <CreditCard size={16} />
                      <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>💳 Pagamento recebido antecipadamente — aguarda confirmação após o trabalho</span>
                    </div>
                  )}

                  {awaitingConfirmation && !jobDone && !showRatingForm && (
                    <button
                      onClick={() => setShowRatingForm(true)}
                      style={{
                        width: "100%", padding: "0.6rem 1rem", borderRadius: "10px", border: "none",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff",
                        fontWeight: "700", fontSize: "0.88rem", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                      }}
                    >
                      <CheckCircle size={15} />
                      Confirmar Trabalho Concluído · Pagar €{jobDetail!.pay.toFixed(2)}
                    </button>
                  )}

                  {showRatingForm && !jobDone && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "var(--muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Avalie o trabalhador
                      </p>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setRating(s)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", opacity: s <= rating ? 1 : 0.3 }}>
                            <Star size={22} fill={s <= rating ? "#ffd233" : "none"} color="#ffd233" />
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="msg-input"
                        placeholder="Comentário sobre o trabalhador (opcional)..."
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => setShowRatingForm(false)}
                          style={{ flex: 1, padding: "0.55rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontWeight: "600" }}>
                          Cancelar
                        </button>
                        <button onClick={handleRelease} disabled={paymentLoading}
                          style={{ flex: 2, padding: "0.55rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", cursor: "pointer", fontWeight: "700", opacity: paymentLoading ? 0.6 : 1 }}>
                          {paymentLoading ? "A confirmar..." : "Confirmar trabalho e pagar"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Worker rates employer after job done */}
                  {jobDone && !isEmployer && !workerReviewDone && (
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "0.6rem", marginTop: "0.2rem" }}>
                      {!showWorkerReview ? (
                        <button
                          onClick={() => setShowWorkerReview(true)}
                          style={{ width: "100%", padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                        >
                          ⭐ Avaliar o empreendedor
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "var(--muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Como foi trabalhar com este empreendedor?
                          </p>
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button key={s} onClick={() => setWorkerReviewRating(s)}
                                style={{ background: "none", border: "none", cursor: "pointer", opacity: s <= workerReviewRating ? 1 : 0.3 }}>
                                <Star size={22} fill={s <= workerReviewRating ? "#ffd233" : "none"} color="#ffd233" />
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            className="msg-input"
                            placeholder="Comentário (opcional)..."
                            value={workerReviewComment}
                            onChange={(e) => setWorkerReviewComment(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button onClick={() => setShowWorkerReview(false)}
                              style={{ flex: 1, padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem" }}>
                              Cancelar
                            </button>
                            <button onClick={handleWorkerReview} disabled={workerReviewLoading}
                              style={{ flex: 2, padding: "0.5rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", opacity: workerReviewLoading ? 0.6 : 1 }}>
                              {workerReviewLoading ? "A enviar..." : "Enviar avaliação ⭐"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {jobDone && !isEmployer && workerReviewDone && (
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: "#22c97a", fontWeight: "600", textAlign: "center" }}>✓ Avaliação enviada. Obrigado!</p>
                  )}
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSend} className="msg-input-row">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Mensagem para ${selectedConv.partnerName}...`}
                  className="msg-input"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  style={{
                    width: "42px", height: "42px", borderRadius: "12px", border: "none",
                    background: inputText.trim() ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--surface2)",
                    color: inputText.trim() ? "#fff" : "var(--muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: inputText.trim() ? "pointer" : "not-allowed", flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="msg-empty">
              <MessageSquare size={56} style={{ opacity: 0.15 }} />
              <div>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: "600", color: "var(--muted)" }}>Selecione uma conversa</p>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.83rem", color: "var(--muted)", opacity: 0.7 }}>
                  ou inicie uma nova a partir do mapa ou vagas
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, userId, onAcceptWorker }: { msg: ChatMessage; userId: number; onAcceptWorker?: (workerId: number, accept: boolean) => void }) {
  const isMe = msg.fromUserId === userId;
  const type = msg.messageType ?? "text";

  if (type === "payment_escrow") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.4rem 0" }}>
        <div style={{
          padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "80%",
          background: "rgba(34,201,122,0.12)", border: "1px solid rgba(34,201,122,0.3)",
          display: "flex", alignItems: "center", gap: "0.6rem",
        }}>
          <Lock size={16} style={{ color: "#22c97a", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>{msg.content}</p>
        </div>
      </div>
    );
  }

  if (type === "payment_released") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.4rem 0" }}>
        <div style={{
          padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "80%",
          background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
          display: "flex", alignItems: "center", gap: "0.6rem",
        }}>
          <CheckCircle size={16} style={{ color: "#6366f1", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>{msg.content}</p>
        </div>
      </div>
    );
  }

  if (type === "application") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.4rem 0" }}>
        <div style={{
          padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "85%",
          background: "rgba(255,210,51,0.1)", border: "1px solid rgba(255,210,51,0.25)",
          display: "flex", alignItems: "flex-start", gap: "0.6rem",
        }}>
          <AlertCircle size={16} style={{ color: "var(--yellow-dark)", flexShrink: 0, marginTop: "0.15rem" }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>{msg.content}</p>
            {onAcceptWorker && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                <button
                  onClick={() => onAcceptWorker(msg.fromUserId, true)}
                  style={{ flex: 1, padding: "0.4rem 0.6rem", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #22c97a, #16a361)", color: "#fff", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer" }}
                >
                  ✓ Aceitar
                </button>
                <button
                  onClick={() => onAcceptWorker(msg.fromUserId, false)}
                  style={{ flex: 1, padding: "0.4rem 0.6rem", borderRadius: "8px", border: "1px solid rgba(240,96,96,0.4)", background: "rgba(240,96,96,0.08)", color: "#f06060", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer" }}
                >
                  ✗ Rejeitar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "72%",
        padding: "0.7rem 1rem",
        borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        ...(isMe
          ? { background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff" }
          : {}),
      }}
        className={isMe ? undefined : "msg-bubble-received"}
      >
        <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: "1.45", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
          {msg.content}
        </p>
        <span style={{ display: "block", fontSize: "0.67rem", marginTop: "0.3rem", opacity: 0.55, textAlign: "right" }}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
