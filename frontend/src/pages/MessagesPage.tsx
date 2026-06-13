import { toast } from "../utils/toast";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ArrowLeft, Briefcase, Clock, Lock, CheckCircle, AlertCircle, Star, CreditCard, X, Flag, EyeOff, Eye, Gift } from "lucide-react";
import { api } from "../utils/api";
import type { ChatMessage, InboxConversation, User } from "../types";
import { JobProposalModal } from "../components/JobProposalModal";

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
  reviewedByMe?: boolean;
};

type MessagesPageProps = {
  user: User;
  initialPartnerId?: number;
  initialPartnerName?: string;
  initialPartnerAvatar?: string;
  initialJobId?: number;
  onWalletRefresh?: () => void;
  t?: (key: any) => string;
};

export function MessagesPage({
  user,
  initialPartnerId,
  initialPartnerName,
  initialPartnerAvatar,
  initialJobId,
  onWalletRefresh,
  t: tProp,
}: MessagesPageProps) {
  // Fallback translator that just returns the key when no t prop provided
  const t = tProp ?? ((key: string) => key);
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
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [respondedProposals, setRespondedProposals] = useState<Set<number>>(new Set());
  const [hiddenConvs, setHiddenConvs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("flexjob_hidden_convs") || "[]"); } catch { return []; }
  });
  const [showCleared, setShowCleared] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("flexjob_tip_dismissed") || "[]"); } catch { return []; }
  });
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  const [partnerReviews, setPartnerReviews] = useState<{ id: number; rating: number; comment: string; reviewer_name: string; created_at: string }[]>([]);
  const [loadingPartnerReviews, setLoadingPartnerReviews] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tip prompt goes away once given (payment_tip message exists) or dismissed for this job
  const tipGiven = messages.some((m) => m.messageType === "payment_tip");
  const tipDismissed = jobDetail ? dismissedTips.includes(jobDetail.id) : false;

  function dismissTip() {
    if (!jobDetail) return;
    const updated = [...dismissedTips, jobDetail.id];
    setDismissedTips(updated);
    localStorage.setItem("flexjob_tip_dismissed", JSON.stringify(updated));
  }

  function openPartnerProfile() {
    if (!selectedConv) return;
    setShowPartnerProfile(true);
    setLoadingPartnerReviews(true);
    api.getReviews(selectedConv.partnerId)
      .then((data) => { setPartnerReviews(data); setLoadingPartnerReviews(false); })
      .catch(() => setLoadingPartnerReviews(false));
  }

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
    setShowReportForm(false);
    setReportReason("");
    setReportSent(false);
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
      onWalletRefresh?.();
      const updated = await api.getJobDetail(jobDetail.id);
      setJobDetail(updated);
      setShowPayForm(false);
      setPayNotes("");
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      toast.error(err.message || t("errorMakingPayment"));
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
      toast.error(err.message || t("errorRespondingApplication"));
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
      toast.error(err.message || t("errorSendingRating"));
    } finally {
      setWorkerReviewLoading(false);
    }
  }

  async function handleTip() {
    if (!jobDetail) return;
    setTipLoading(true);
    try {
      await api.tipWorker(jobDetail.id, tipAmount);
      onWalletRefresh?.();
      setShowTipForm(false);
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      toast.error(err.message || t("errorSendingTip"));
    } finally {
      setTipLoading(false);
    }
  }

  async function handleReport() {
    if (!selectedConv) return;
    setReportLoading(true);
    try {
      const jobId = selectedConv.jobId > 0 ? selectedConv.jobId : undefined;
      await api.reportConversation(selectedConv.partnerId, jobId, reportReason);
      setReportSent(true);
      setShowReportForm(false);
      setReportReason("");
    } catch (err: any) {
      toast.error(err.message || t("errorReporting"));
    } finally {
      setReportLoading(false);
    }
  }

  function hideConv(partnerId: number, jobId: number) {
    const key = `${partnerId}-${jobId}`;
    if (hiddenConvs.includes(key)) return;
    const updated = [...hiddenConvs, key];
    setHiddenConvs(updated);
    localStorage.setItem("flexjob_hidden_convs", JSON.stringify(updated));
    if (selectedConv?.partnerId === partnerId && selectedConv?.jobId === jobId) {
      setSelectedConv(null);
    }
  }

  function clearAllConvs() {
    const keys = conversations.map((c) => `${c.partnerId}-${c.jobId}`);
    const merged = Array.from(new Set([...hiddenConvs, ...keys]));
    setHiddenConvs(merged);
    localStorage.setItem("flexjob_hidden_convs", JSON.stringify(merged));
    setSelectedConv(null);
  }

  function restoreAllConvs() {
    setHiddenConvs([]);
    localStorage.removeItem("flexjob_hidden_convs");
    setShowCleared(false);
  }

  async function handleRespondProposal(jobId: number, accept: boolean) {
    try {
      await api.respondToProposal(jobId, accept);
      setRespondedProposals((prev) => new Set([...prev, jobId]));
      const currentJobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      if (accept) {
        setSelectedConv((prev) => prev ? { ...prev, jobId } : prev);
        const detail = await api.getJobDetail(jobId);
        setJobDetail(detail);
      }
      const data = await api.getMessages(selectedConv!.partnerId, accept ? jobId : currentJobId);
      setMessages(data);
    } catch (err: any) {
      toast.error(err?.message || t("errorRespondingProposal"));
    }
  }

  async function handleRelease() {
    if (!jobDetail) return;
    setPaymentLoading(true);
    try {
      await api.releasePayment(jobDetail.id, rating, ratingComment);
      onWalletRefresh?.();
      const updated = await api.getJobDetail(jobDetail.id);
      setJobDetail(updated);
      setShowRatingForm(false);
      const jobId = selectedConv!.jobId > 0 ? selectedConv!.jobId : undefined;
      const data = await api.getMessages(selectedConv!.partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      toast.error(err.message || t("errorConfirmingWork"));
    } finally {
      setPaymentLoading(false);
    }
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  }

  function avatarUrl(id: number, src?: string): string {
    return src || `https://api.dicebear.com/7.x/thumbs/svg?seed=${id}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
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

  const visibleConvs = conversations.filter((c) =>
    showCleared || !hiddenConvs.includes(`${c.partnerId}-${c.jobId}`)
  );
  const hiddenCount = conversations.filter((c) =>
    hiddenConvs.includes(`${c.partnerId}-${c.jobId}`)
  ).length;

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
            <div>
              <h2>{t("messagesTitle")}</h2>
              <p>{visibleConvs.length} {visibleConvs.length !== 1 ? t("conversationCount_other") : t("conversationCount_one")}</p>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowCleared((v) => !v)}
                  title={showCleared ? t("hideConvTitle") : `${t("showHiddenConvs").replace("{count}", String(hiddenCount))}${hiddenCount !== 1 ? "s" : ""}`}
                  style={{
                    background: showCleared ? "rgba(99,102,241,0.15)" : "var(--surface2)",
                    border: "1px solid " + (showCleared ? "rgba(99,102,241,0.4)" : "var(--line)"),
                    borderRadius: "8px", padding: "5px 8px", cursor: "pointer",
                    color: showCleared ? "#6366f1" : "var(--muted)",
                    display: "flex", alignItems: "center", gap: "4px",
                    fontSize: "0.72rem", fontWeight: 600, transition: "all 0.15s",
                  }}
                >
                  {showCleared ? <EyeOff size={12} /> : <Eye size={12} />}
                  {hiddenCount}
                </button>
              )}
              {conversations.length > 0 && (
                <button
                  onClick={clearAllConvs}
                  title={t("clearAllConvs")}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--line)",
                    borderRadius: "8px", padding: "5px 8px", cursor: "pointer",
                    color: "var(--muted)", display: "flex", alignItems: "center",
                    fontSize: "0.72rem", fontWeight: 600, transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--line)"; }}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingInbox ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>{t("loadingInbox")}</div>
            ) : visibleConvs.length === 0 && conversations.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                <MessageSquare size={40} style={{ color: "var(--line)", marginBottom: "1rem", display: "block", margin: "0 auto 1rem" }} />
                <p style={{ color: "var(--muted)", fontSize: "0.87rem", lineHeight: "1.55", margin: 0 }}>
                  {t("noConversations").split("\n").map((line, i) => <span key={i}>{line}{i === 0 ? <br /> : null}</span>)}
                </p>
              </div>
            ) : visibleConvs.length === 0 ? (
              <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
                <EyeOff size={32} style={{ color: "var(--line)", marginBottom: "0.75rem", display: "block", margin: "0 auto 0.75rem" }} />
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                  {t("allConvsCleared")}
                </p>
                <button
                  onClick={restoreAllConvs}
                  style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
                >
                  {t("restoreAll")}
                </button>
              </div>
            ) : (
              <>
                {visibleConvs.map((conv) => {
                  const isActive =
                    selectedConv?.partnerId === conv.partnerId &&
                    selectedConv?.jobId === conv.jobId;
                  const isHidden = hiddenConvs.includes(`${conv.partnerId}-${conv.jobId}`);
                  return (
                    <div
                      key={`${conv.partnerId}-${conv.jobId}`}
                      style={{ position: "relative", display: "flex", alignItems: "stretch" }}
                      className="msg-conv-wrap"
                    >
                      <button
                        onClick={() => setSelectedConv(conv)}
                        className={`msg-conv-btn ${isActive ? "active" : ""}`}
                        style={{ flex: 1 }}
                      >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img
                            src={avatarUrl(conv.partnerId, conv.partnerAvatar)}
                            alt={conv.partnerName}
                            style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)" }}
                          />
                          <span style={{
                            position: "absolute", bottom: "1px", right: "1px",
                            width: "9px", height: "9px", background: isHidden ? "var(--muted)" : "#10b981",
                            borderRadius: "50%", border: "2px solid var(--surface)",
                          }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.1rem" }}>
                            <span style={{ fontWeight: "600", color: isHidden ? "var(--muted)" : "var(--ink)", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: isHidden ? "italic" : undefined }}>
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
                            {conv.lastMessage || t("initConversation")}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); hideConv(conv.partnerId, conv.jobId); }}
                        title={t("hideConversation")}
                        className="msg-conv-hide-btn"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--muted)", padding: "0 8px", flexShrink: 0,
                          opacity: 0, transition: "opacity 0.15s",
                          display: "flex", alignItems: "center",
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
                {!showCleared && hiddenCount > 0 && (
                  <button
                    onClick={() => setShowCleared(true)}
                    style={{
                      width: "100%", padding: "0.65rem", border: "none", borderTop: "1px solid var(--line)",
                      background: "none", color: "var(--muted)", fontSize: "0.78rem",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <Eye size={12} />
                    {hiddenCount !== 1 ? t("seeHiddenConvs_other").replace("{count}", String(hiddenCount)) : t("seeHiddenConvs_one").replace("{count}", String(hiddenCount))}
                  </button>
                )}
                {showCleared && hiddenCount > 0 && (
                  <button
                    onClick={restoreAllConvs}
                    style={{
                      width: "100%", padding: "0.65rem", border: "none", borderTop: "1px solid var(--line)",
                      background: "none", color: "#6366f1", fontSize: "0.78rem",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", fontWeight: 600,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    {t("restoreAllHidden")}
                  </button>
                )}
              </>
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
                <img
                  src={avatarUrl(selectedConv.partnerId, selectedConv.partnerAvatar)}
                  alt={selectedConv.partnerName}
                  onClick={openPartnerProfile}
                  title={t("viewProfile")}
                  style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--line)", cursor: "pointer" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    onClick={openPartnerProfile}
                    title={t("viewProfile")}
                    style={{ margin: 0, fontSize: "0.92rem", fontWeight: "700", color: "var(--ink)", cursor: "pointer" }}
                  >
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
                {/* Report button */}
                {reportSent ? (
                  <span style={{ fontSize: "0.7rem", color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>{t("reportSent")}</span>
                ) : (
                  <button
                    onClick={() => setShowReportForm((v) => !v)}
                    title={t("reportConversation")}
                    style={{
                      background: showReportForm ? "rgba(239,68,68,0.12)" : "none",
                      border: "1px solid " + (showReportForm ? "rgba(239,68,68,0.4)" : "transparent"),
                      borderRadius: 8, padding: "4px 8px", cursor: "pointer",
                      color: showReportForm ? "#ef4444" : "var(--muted)",
                      display: "flex", alignItems: "center", gap: "0.3rem",
                      fontSize: "0.72rem", fontWeight: 600, flexShrink: 0, transition: "all 0.15s",
                    }}
                  >
                    <Flag size={12} />
                    {t("reportConversation")}
                  </button>
                )}
                {isEmployer && (
                  <button
                    onClick={() => setShowProposalModal(true)}
                    title={t("proposeWork")}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.35rem",
                      padding: "0.4rem 0.8rem", borderRadius: "10px",
                      border: "1px solid rgba(251,191,36,0.4)",
                      background: "rgba(251,191,36,0.1)",
                      color: "#f59e0b", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer",
                      flexShrink: 0, transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(251,191,36,0.1)"; }}
                  >
                    <Briefcase size={14} />
                    {t("proposeWork")}
                  </button>
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
                    {t("payInAdvance")}
                  </button>
                )}
              </div>

              {/* ── Report form panel ── */}
              {showReportForm && !reportSent && (
                <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--line)", background: "rgba(239,68,68,0.05)", borderLeft: "3px solid #ef4444" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#ef4444" }}>🚩 {t("reportTitle")}</p>
                    <button onClick={() => setShowReportForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.2rem" }}>
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder={t("reportPlaceholder")}
                    rows={2}
                    className="msg-input"
                    style={{ width: "100%", boxSizing: "border-box", resize: "none", marginBottom: "0.5rem", fontSize: "0.82rem" }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => setShowReportForm(false)}
                      style={{ flex: 1, padding: "0.45rem", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                      {t("reportCancel")}
                    </button>
                    <button onClick={handleReport} disabled={reportLoading}
                      style={{ flex: 2, padding: "0.45rem", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, opacity: reportLoading ? 0.6 : 1 }}>
                      {reportLoading ? t("reportSending") : t("reportConfirm")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Payment form panel ── */}
              {showPayForm && canPay && (
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", background: "var(--surface2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "var(--ink)" }}>
                      💳 {t("escrowTitle")}
                    </h4>
                    <button onClick={() => setShowPayForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.2rem" }}>
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("hoursLabel")}</span>
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
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>{t("workDateLabel")}</span>
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
                    placeholder={t("payNoteLabel")}
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
                    {paymentLoading ? t("processingPayment") : `💳 ${t("payInAdvance")} €${(payHours * jobDetail!.pay).toFixed(2)}`}
                  </button>
                </div>
              )}

              {/* Messages area */}
              <div className="msg-chat-area">
                {loadingMessages && messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                    {t("loadingMessages")}
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", textAlign: "center", gap: "0.75rem", padding: "2rem" }}>
                    <MessageSquare size={44} style={{ opacity: 0.25 }} />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>
                      {t("startConversation")} {selectedConv.partnerName}!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      userId={user.id ?? 0}
                      onAcceptWorker={isEmployer && jobDetail?.status === "open" ? handleAcceptWorker : undefined}
                      onRespondProposal={!isEmployer ? handleRespondProposal : undefined}
                      respondedProposals={respondedProposals}
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
                        <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>{t("jobDoneConfirm").replace("{amount}", jobDetail!.pay.toFixed(2))}</span>
                      </div>
                      {isEmployer && !tipGiven && !tipDismissed && (
                        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "0.6rem", marginTop: "0.2rem" }}>
                          {!showTipForm ? (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                onClick={() => setShowTipForm(true)}
                                style={{ flex: 1, padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                              >
                                🎁 {t("tipWorker")}
                              </button>
                              <button
                                onClick={dismissTip}
                                aria-label="Fechar"
                                title={t("tipDismiss")}
                                style={{ padding: "0 0.7rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center" }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: "600", textTransform: "uppercase" }}>{t("tipAmount")}</span>
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
                                  {t("tipCancel")}
                                </button>
                                <button
                                  onClick={handleTip}
                                  disabled={tipLoading}
                                  style={{ flex: 2, padding: "0.5rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", opacity: tipLoading ? 0.6 : 1 }}
                                >
                                  {tipLoading ? t("sendingTip") : t("sendTip").replace("{amount}", tipAmount.toFixed(2))}
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
                      <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>{t("workerEscrowMessage")}</span>
                    </div>
                  )}
                  {awaitingConfirmation && !jobDone && !isEmployer && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.9rem", borderRadius: "10px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#6366f1" }}>
                      <CreditCard size={16} />
                      <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>{t("workerEscrowMessage")}</span>
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
                      {t("confirmJobDone").replace("{amount}", jobDetail!.pay.toFixed(2))}
                    </button>
                  )}

                  {showRatingForm && !jobDone && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "var(--muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {t("rateWorker")}
                      </p>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setRating(s)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", opacity: s <= rating ? 1 : 0.3 }}>
                            <Star size={22} fill={s <= rating ? "#f3cd3c" : "none"} color="#f3cd3c" />
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="msg-input"
                        placeholder={t("ratingComment")}
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => setShowRatingForm(false)}
                          style={{ flex: 1, padding: "0.55rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontWeight: "600" }}>
                          {t("ratingCancel")}
                        </button>
                        <button onClick={handleRelease} disabled={paymentLoading}
                          style={{ flex: 2, padding: "0.55rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", cursor: "pointer", fontWeight: "700", opacity: paymentLoading ? 0.6 : 1 }}>
                          {paymentLoading ? t("confirmingPayment") : t("confirmAndPay")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Worker rates employer after job done — hidden once reviewed (persists via reviewedByMe) */}
                  {jobDone && !isEmployer && !workerReviewDone && !jobDetail?.reviewedByMe && (
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "0.6rem", marginTop: "0.2rem" }}>
                      {!showWorkerReview ? (
                        <button
                          onClick={() => setShowWorkerReview(true)}
                          style={{ width: "100%", padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer" }}
                        >
                          ⭐ {t("rateEmployer")}
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "var(--muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {t("rateEmployerQuestion")}
                          </p>
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button key={s} onClick={() => setWorkerReviewRating(s)}
                                style={{ background: "none", border: "none", cursor: "pointer", opacity: s <= workerReviewRating ? 1 : 0.3 }}>
                                <Star size={22} fill={s <= workerReviewRating ? "#f3cd3c" : "none"} color="#f3cd3c" />
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            className="msg-input"
                            placeholder={t("ratingCommentShort")}
                            value={workerReviewComment}
                            onChange={(e) => setWorkerReviewComment(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button onClick={() => setShowWorkerReview(false)}
                              style={{ flex: 1, padding: "0.5rem", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem" }}>
                              {t("ratingCancel")}
                            </button>
                            <button onClick={handleWorkerReview} disabled={workerReviewLoading}
                              style={{ flex: 2, padding: "0.5rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", opacity: workerReviewLoading ? 0.6 : 1 }}>
                              {workerReviewLoading ? t("sendingRating") : t("sendRating")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {jobDone && !isEmployer && workerReviewDone && (
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: "#22c97a", fontWeight: "600", textAlign: "center" }}>{t("ratingThankYou")}</p>
                  )}
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSend} className="msg-input-row">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`${t("messageInputPlaceholder")} ${selectedConv.partnerName}...`}
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
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: "600", color: "var(--muted)" }}>{t("selectConversation")}</p>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.83rem", color: "var(--muted)", opacity: 0.7 }}>
                  {t("selectConversationHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job Proposal Modal — employer sends proposal from any chat */}
      {/* Partner profile modal — info + reviews from others */}
      {showPartnerProfile && selectedConv && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
          onClick={() => setShowPartnerProfile(false)}
        >
          <div
            style={{ width: "100%", maxWidth: "420px", maxHeight: "80vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "1.5rem 1.5rem 1rem", textAlign: "center", position: "relative", background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.08))" }}>
              <button
                onClick={() => setShowPartnerProfile(false)}
                aria-label="Fechar"
                style={{ position: "absolute", top: "0.9rem", right: "0.9rem", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink)", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
              <img
                src={avatarUrl(selectedConv.partnerId, selectedConv.partnerAvatar)}
                alt={selectedConv.partnerName}
                style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", border: "3px solid #6366f1", padding: "3px", margin: "0 auto 0.6rem", background: "var(--surface2)" }}
              />
              <h3 style={{ margin: "0 0 0.2rem", fontSize: "1.15rem", fontWeight: "700", color: "var(--ink)" }}>{selectedConv.partnerName}</h3>
              {partnerReviews.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", color: "#facc15", fontSize: "0.95rem" }}>
                  <Star size={15} fill="#facc15" />
                  <strong>{(partnerReviews.reduce((s, r) => s + r.rating, 0) / partnerReviews.length).toFixed(1)}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>({partnerReviews.length})</span>
                </div>
              )}
            </div>
            <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
              <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>{t("recentReviews")}</h4>
              {loadingPartnerReviews ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>{t("loadingReviews")}</p>
              ) : partnerReviews.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>{t("noReviews")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {partnerReviews.map((r) => (
                    <div key={r.id} style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                        <Star size={13} fill="#facc15" style={{ color: "#facc15" }} />
                        <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{r.rating.toFixed(1)}</strong>
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginLeft: "auto" }}>{r.reviewer_name}</span>
                      </div>
                      {r.comment && <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink)", lineHeight: "1.45" }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showProposalModal && selectedConv && (
        <JobProposalModal
          workerId={selectedConv.partnerId}
          workerName={selectedConv.partnerName}
          currentUser={user}
          onClose={() => setShowProposalModal(false)}
          onSent={(jobId) => {
            setShowProposalModal(false);
            setSelectedConv((prev) => prev ? { ...prev, jobId } : prev);
          }}
        />
      )}
    </div>
  );
}

function MessageBubble({ msg, userId, onAcceptWorker, onRespondProposal, respondedProposals }: {
  msg: ChatMessage;
  userId: number;
  onAcceptWorker?: (workerId: number, accept: boolean) => void;
  onRespondProposal?: (jobId: number, accept: boolean) => void;
  respondedProposals?: Set<number>;
}) {
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

  if (type === "admin_warning") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.6rem 0" }}>
        <div style={{ width: "100%", maxWidth: "440px", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", background: "rgba(239,68,68,0.14)", borderBottom: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={15} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: "0.78rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.6px" }}>Aviso da Administração</span>
            <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--muted)" }}>
              {new Date(msg.createdAt).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div style={{ padding: "10px 14px" }}>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--ink)", lineHeight: 1.55 }}>{msg.content}</p>
            <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#ef4444", fontWeight: 600 }}>
              ⚠ Este aviso conta para o limite de 3 avisos. Ao terceiro aviso a conta é suspensa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (type === "payment_tip") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.4rem 0" }}>
        <div style={{
          padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "80%",
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
          display: "flex", alignItems: "center", gap: "0.6rem",
        }}>
          <Gift size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>{msg.content}</p>
        </div>
      </div>
    );
  }

  if (type === "job_proposal") {
    let data: { jobId?: number; title?: string; description?: string; pay?: number; duration?: string; workDate?: string; address?: string } = {};
    try { data = JSON.parse(msg.content); } catch {}
    const jobId = data.jobId ?? 0;
    // Responded either in this session or (after refresh) per the job's real status
    const alreadyResponded = respondedProposals?.has(jobId) || (!!msg.jobStatus && msg.jobStatus !== "proposed");
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.6rem 0" }}>
        <div style={{ width: "100%", maxWidth: "380px", background: "var(--surface2)", border: "2px solid rgba(251,191,36,0.35)", borderRadius: "16px", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px 8px", background: "rgba(251,191,36,0.1)", borderBottom: "1px solid rgba(251,191,36,0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Briefcase size={15} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--ink)" }}>Proposta de Trabalho</span>{/* NOTE: MessageBubble does not receive t — proposal title uses hardcoded PT string here */}
            <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--muted)" }}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div style={{ padding: "10px 14px" }}>
            {data.title && <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "1rem", color: "var(--ink)" }}>{data.title}</p>}
            {data.description && <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.45 }}>{data.description}</p>}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {!!data.pay && data.pay > 0 && (
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#22c97a", background: "rgba(34,201,122,0.1)", border: "1px solid rgba(34,201,122,0.2)", borderRadius: "6px", padding: "2px 7px" }}>€{data.pay}/h</span>
              )}
              {data.duration && <span style={{ fontSize: "0.78rem", color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "6px", padding: "2px 7px" }}>⏱ {data.duration}</span>}
              {data.workDate && <span style={{ fontSize: "0.78rem", color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "6px", padding: "2px 7px" }}>📅 {data.workDate}</span>}
              {data.address && <span style={{ fontSize: "0.78rem", color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "6px", padding: "2px 7px" }}>📍 {data.address}</span>}
            </div>
          </div>
          {onRespondProposal && jobId > 0 && !alreadyResponded ? (
            <div style={{ padding: "8px 14px 12px", display: "flex", gap: "8px" }}>
              <button onClick={() => onRespondProposal(jobId, true)}
                style={{ flex: 1, padding: "8px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #22c97a, #16a361)", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                ✓ Aceitar proposta
              </button>
              <button onClick={() => onRespondProposal(jobId, false)}
                style={{ flex: 1, padding: "8px", borderRadius: "10px", border: "1px solid rgba(240,96,96,0.4)", background: "rgba(240,96,96,0.08)", color: "#f06060", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                ✗ Rejeitar
              </button>
            </div>
          ) : (
            <div style={{ padding: "6px 14px 10px" }}>
              <p style={{ margin: 0, fontSize: "0.78rem", color: alreadyResponded && msg.jobStatus === "closed" ? "#f06060" : alreadyResponded ? "#22c97a" : "var(--muted)", fontStyle: "italic", fontWeight: alreadyResponded ? 700 : 400 }}>
                {alreadyResponded
                  ? (msg.jobStatus === "closed"
                      ? "✗ Proposta recusada"
                      : isMe
                      ? "✓ Proposta aceite"
                      : "✓ Já respondeste a esta proposta")
                  : isMe
                  ? "Aguarda a resposta do trabalhador..."
                  : "Proposta recebida"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "proposal_rejected") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.4rem 0" }}>
        <div style={{ padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "80%", background: "rgba(240,96,96,0.1)", border: "1px solid rgba(240,96,96,0.25)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <AlertCircle size={16} style={{ color: "#f06060", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>{msg.content}</p>
        </div>
      </div>
    );
  }

  if (type === "proposal_accepted") {
    // isMe = worker (sent the acceptance); !isMe = employer (receives the action prompt)
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.4rem 0" }}>
        {isMe ? (
          // Worker view: waiting for employer payment
          <div style={{ padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "80%", background: "rgba(255,210,51,0.1)", border: "1px solid rgba(255,210,51,0.3)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Clock size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>
              ⏳ Proposta aceite — a aguardar pagamento de {msg.toName}
            </p>
          </div>
        ) : (
          // Employer view: action prompt
          <div style={{ padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "80%", background: "rgba(34,201,122,0.12)", border: "1px solid rgba(34,201,122,0.3)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle size={16} style={{ color: "#22c97a", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", fontWeight: "600", lineHeight: 1.4 }}>{msg.content}</p>
          </div>
        )}
      </div>
    );
  }

  if (type === "admin_warning") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "0.5rem 0" }}>
        <div style={{ padding: "0.7rem 1.1rem", borderRadius: "14px", maxWidth: "88%", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
          <AlertCircle size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "0.72rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Aviso do Admin</p>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink)", lineHeight: 1.4 }}>{msg.content}</p>
          </div>
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
