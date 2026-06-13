import { toast } from "../utils/toast";
import { useEffect, useRef, useState } from "react";
import { Send, X, MessageCircle, Briefcase, CheckCircle, XCircle } from "lucide-react";
import { api } from "../utils/api";
import { JobProposalModal } from "./JobProposalModal";
import type { ChatMessage, User } from "../types";
import type { TranslationKey } from "../i18n/translations";

interface ChatModalProps {
  partnerId: number;
  partnerName: string;
  partnerAvatar?: string;
  jobId?: number;
  onClose: () => void;
  currentUser: User;
  t?: (key: TranslationKey) => string;
}

export function ChatModal({
  partnerId,
  partnerName,
  partnerAvatar,
  jobId,
  onClose,
  currentUser,
  t: tProp,
}: ChatModalProps) {
  const t = tProp ?? ((key: string) => key);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showProposal, setShowProposal] = useState(false);
  const [respondingJob, setRespondingJob] = useState<number | null>(null);
  const [respondedJobIds, setRespondedJobIds] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages initially and set up polling
  useEffect(() => {
    let active = true;

    async function fetchMessages() {
      try {
        const data = await api.getMessages(partnerId, jobId);
        if (active) {
          setMessages(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading chat messages:", err);
      }
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [partnerId, jobId]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleRespondProposal(jobId: number, accept: boolean) {
    setRespondingJob(jobId);
    try {
      await api.respondToProposal(jobId, accept);
      setRespondedJobIds((prev) => new Set([...prev, jobId]));
      const data = await api.getMessages(partnerId, jobId);
      setMessages(data);
    } catch (err: any) {
      toast.error(err?.message || "Error responding to proposal.");
    } finally {
      setRespondingJob(null);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText("");

    try {
      await api.sendMessage(partnerId, content, jobId);
      // Immediately refetch messages to show the sent message faster
      const data = await api.getMessages(partnerId, jobId);
      setMessages(data);
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Could not send message.");
    }
  }

  const resolvedAvatar = partnerAvatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${partnerId}&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <div className="chat-modal-overlay">
      <div className="chat-modal-container">
        {/* Header */}
        <header className="chat-modal-header">
          <div className="chat-partner-info">
            <img src={resolvedAvatar} alt={partnerName} className="chat-avatar" />
            <div>
              <h3 className="chat-partner-name">{partnerName}</h3>
              <p className="chat-status-indicator">
                <span className="online-dot"></span> {t("chatOnline")}
              </p>
            </div>
          </div>
          <button className="chat-close-button reset-button" onClick={onClose} aria-label={t("chatCloseBtnLabel")}>
            <X size={20} />
          </button>
        </header>

        {/* Message area */}
        <main className="chat-messages-container">
          {loading && messages.length === 0 ? (
            <div className="chat-messages-loading">
              <span className="spinner"></span> {t("chatLoadingMessages")}
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-no-messages">
              <MessageCircle size={48} className="chat-empty-icon" />
              <p>{t("chatStartConversation")} {partnerName}.</p>
            </div>
          ) : (
            <div className="chat-message-list">
              {messages.map((msg) => {
                const isMe = msg.fromUserId === currentUser.id;
                const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const isWorker = currentUser.role === "worker";

                // Job proposal card
                if (msg.messageType === "job_proposal") {
                  let proposal: any = null;
                  try { proposal = JSON.parse(msg.content); } catch { /* ignore */ }
                  // Responded in this session or (after refresh/reopen) per the job's real status
                  const alreadyResponded = respondedJobIds.has(proposal?.jobId ?? 0) || (!!msg.jobStatus && msg.jobStatus !== "proposed");
                  const canRespond = isWorker && !isMe && !alreadyResponded;
                  const isResponding = respondingJob === proposal?.jobId;
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "85%", borderRadius: "16px", border: "2px solid rgba(255,210,51,0.4)", background: "var(--surface)", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
                        {/* Card header */}
                        <div style={{ padding: "10px 14px 8px", background: "rgba(255,210,51,0.1)", borderBottom: "1px solid rgba(255,210,51,0.2)", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Briefcase size={15} style={{ color: "var(--yellow)", flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("chatProposalTitle")}</span>
                        </div>
                        {/* Card body */}
                        {proposal ? (
                          <div style={{ padding: "10px 14px" }}>
                            <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "14px", color: "var(--ink)" }}>{proposal.title}</p>
                            {proposal.description && <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>{proposal.description}</p>}
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                              <span style={{ padding: "3px 9px", borderRadius: "999px", background: "rgba(255,210,51,0.15)", border: "1px solid rgba(255,210,51,0.25)", fontSize: "12px", fontWeight: 700, color: "var(--yellow)" }}>€{proposal.pay}/h</span>
                              {proposal.duration && <span style={{ padding: "3px 9px", borderRadius: "999px", background: "var(--surface2)", border: "1px solid var(--line)", fontSize: "12px", color: "var(--muted)" }}>⏱ {proposal.duration}</span>}
                              {proposal.workDate && <span style={{ padding: "3px 9px", borderRadius: "999px", background: "var(--surface2)", border: "1px solid var(--line)", fontSize: "12px", color: "var(--muted)" }}>📅 {proposal.workDate}</span>}
                            </div>
                            {canRespond && (
                              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                <button onClick={() => handleRespondProposal(proposal.jobId, true)} disabled={isResponding}
                                  style={{ flex: 1, padding: "8px", borderRadius: "10px", border: "none", background: "var(--green)", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", opacity: isResponding ? 0.55 : 1 }}>
                                  <CheckCircle size={14} /> {t("chatAccept")}
                                </button>
                                <button onClick={() => handleRespondProposal(proposal.jobId, false)} disabled={isResponding}
                                  style={{ flex: 1, padding: "8px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--muted)", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", opacity: isResponding ? 0.55 : 1 }}>
                                  <XCircle size={14} /> {t("chatReject")}
                                </button>
                              </div>
                            )}
                            {isMe && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)", textAlign: "right" }}>{t("chatWaitingWorker")}</p>}
                            {!isMe && !canRespond && alreadyResponded && (
                              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)", fontStyle: "italic" }}>{t("chatProposalResponded")}</p>
                            )}
                          </div>
                        ) : (
                          <div style={{ padding: "10px 14px" }}><p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>{msg.content}</p></div>
                        )}
                        <div style={{ padding: "0 14px 8px", textAlign: "right" }}>
                          <span style={{ fontSize: "10px", color: "var(--muted)", opacity: 0.7 }}>{formattedTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Proposal accepted — different message per side
                if (msg.messageType === "proposal_accepted") {
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                      {isMe ? (
                        // Worker: waiting for payment
                        <div style={{ padding: "6px 14px", borderRadius: "10px", background: "rgba(255,210,51,0.1)", border: "1px solid rgba(255,210,51,0.3)", maxWidth: "85%", textAlign: "center" }}>
                          <p style={{ margin: 0, fontSize: "12px", color: "#f59e0b", fontWeight: 600 }}>{t("chatProposalAccepted").replace("{name}", msg.toName ?? "")}</p>
                          <span style={{ fontSize: "10px", color: "var(--muted)", opacity: 0.7 }}>{formattedTime}</span>
                        </div>
                      ) : (
                        // Employer: action prompt
                        <div style={{ padding: "6px 14px", borderRadius: "10px", background: "rgba(34,201,122,0.1)", border: "1px solid rgba(34,201,122,0.3)", maxWidth: "85%", textAlign: "center" }}>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--green)", fontWeight: 600 }}>{msg.content}</p>
                          <span style={{ fontSize: "10px", color: "var(--muted)", opacity: 0.7 }}>{formattedTime}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                // System messages (payment, application, warnings, etc.)
                if (msg.messageType !== "text") {
                  const color = msg.messageType === "payment_escrow" || msg.messageType === "payment_released" ? "var(--green)"
                    : msg.messageType === "proposal_rejected" ? "#ef4444"
                    : msg.messageType === "admin_warning" ? "#f59e0b"
                    : "var(--muted)";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{ padding: "6px 14px", borderRadius: "10px", background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, maxWidth: "85%", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "12px", color, fontWeight: 600 }}>{msg.content}</p>
                        <span style={{ fontSize: "10px", color: "var(--muted)", opacity: 0.7 }}>{formattedTime}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`chat-message-bubble-wrapper ${isMe ? "me" : "them"}`}>
                    <div className="chat-message-bubble">
                      <p className="chat-message-content">{msg.content}</p>
                      <span className="chat-message-time">{formattedTime}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Footer input form */}
        <footer className="chat-modal-footer">
          <form onSubmit={handleSend} className="chat-input-form">
            {currentUser.role === "employer" && (
              <button type="button" onClick={() => setShowProposal(true)} className="chat-propose-button" title={t("proposeJob")}>
                <Briefcase size={17} />
              </button>
            )}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t("chatMessagePlaceholder")}
              className="chat-text-input"
              autoFocus
            />
            <button type="submit" className="chat-send-button" disabled={!inputText.trim()}>
              <Send size={18} />
            </button>
          </form>
        </footer>
      </div>

      {/* Job proposal modal overlay */}
      {showProposal && (
        <JobProposalModal
          workerId={partnerId}
          workerName={partnerName}
          currentUser={currentUser}
          onClose={() => setShowProposal(false)}
          onSent={async (jobId) => {
            setShowProposal(false);
            const data = await api.getMessages(partnerId, jobId);
            setMessages(data);
          }}
        />
      )}

      <style>{`
        .chat-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: fadeIn 0.2s ease-out;
        }

        .chat-modal-container {
          width: 100%;
          max-width: 480px;
          height: 600px;
          max-height: 85vh;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-modal-header {
          padding: 16px 20px;
          background: var(--surface);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .chat-partner-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--yellow);
        }

        .chat-avatar-fallback {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--yellow);
          color: #181506;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          flex-shrink: 0;
        }

        .chat-partner-name {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--ink);
        }

        .chat-status-indicator {
          margin: 2px 0 0 0;
          font-size: 0.75rem;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .online-dot {
          width: 6px;
          height: 6px;
          background: var(--green);
          border-radius: 50%;
          display: inline-block;
        }

        .chat-close-button {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          background: var(--surface2);
          border: 1px solid var(--line);
          transition: all 0.2s;
        }

        .chat-close-button:hover {
          color: var(--ink);
          background: var(--line);
        }

        .chat-messages-container {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .chat-messages-loading,
        .chat-no-messages {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--muted);
          padding: 32px;
        }

        .chat-empty-icon {
          color: var(--muted);
          margin-bottom: 12px;
        }

        .chat-message-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chat-message-bubble-wrapper {
          display: flex;
          width: 100%;
        }

        .chat-message-bubble-wrapper.me {
          justify-content: flex-end;
        }

        .chat-message-bubble-wrapper.them {
          justify-content: flex-start;
        }

        .chat-message-bubble {
          max-width: 75%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 0.9rem;
          line-height: 1.4;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
          position: relative;
        }

        .chat-message-bubble-wrapper.me .chat-message-bubble {
          background: var(--yellow);
          color: #181506;
          border-bottom-right-radius: 4px;
        }

        .chat-message-bubble-wrapper.them .chat-message-bubble {
          background: var(--surface2);
          color: var(--ink);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--line);
        }

        .chat-message-content {
          margin: 0;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .chat-message-time {
          display: block;
          text-align: right;
          font-size: 0.7rem;
          margin-top: 4px;
          opacity: 0.65;
        }

        .chat-message-bubble-wrapper.me .chat-message-time {
          color: #181506;
        }

        .chat-message-bubble-wrapper.them .chat-message-time {
          color: var(--muted);
        }

        .chat-modal-footer {
          padding: 16px 20px;
          background: var(--surface);
          border-top: 1px solid var(--line);
          flex-shrink: 0;
        }

        .chat-input-form {
          display: flex;
          gap: 12px;
        }

        .chat-text-input {
          flex: 1;
          height: 44px;
          padding: 0 16px;
          border: 1px solid var(--line);
          border-radius: 14px;
          outline: none;
          font-size: 0.95rem;
          background: var(--bg);
          color: var(--ink);
          transition: border-color 0.2s;
          font-family: inherit;
        }

        .chat-text-input::placeholder {
          color: var(--muted);
        }

        .chat-text-input:focus {
          border-color: var(--yellow);
        }

        .chat-send-button {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--yellow);
          color: #181506;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          border: none;
          flex-shrink: 0;
        }

        .chat-send-button:hover:not(:disabled) {
          background: var(--yellow-dark);
          transform: translateY(-1px);
        }

        .chat-send-button:disabled {
          background: var(--surface2);
          color: var(--muted);
          cursor: not-allowed;
        }

        .chat-propose-button {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(255,210,51,0.12);
          color: var(--yellow);
          border: 1px solid rgba(255,210,51,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .chat-propose-button:hover {
          background: rgba(255,210,51,0.22);
          border-color: var(--yellow);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
