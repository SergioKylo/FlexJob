import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ArrowLeft, Briefcase, Clock } from "lucide-react";
import { api } from "../utils/api";
import type { ChatMessage, InboxConversation, User } from "../types";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Load inbox on mount; refresh every 5s
  useEffect(() => {
    let active = true;
    async function fetchInbox() {
      try {
        const data = await api.getInbox();
        if (!active) return;
        setConversations(data);
        setLoadingInbox(false);
        // If we were given an initial chat partner, auto-select them
        if (initialPartnerId && !selectedConv) {
          const existing = data.find(
            (c) => c.partnerId === initialPartnerId && (initialJobId ? c.jobId === initialJobId : true)
          );
          if (existing) {
            setSelectedConv(existing);
          } else if (initialPartnerName) {
            // Synthetic conversation for a brand-new chat
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

  // Load messages when active conversation changes
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

  const PANEL_HEIGHT = "calc(100dvh - 140px)";

  return (
    <div style={{ display: "flex", height: PANEL_HEIGHT, overflow: "hidden" }}>

      {/* ── Conversation list ── */}
      {showList && (
        <div style={{
          width: isMobile ? "100%" : "320px",
          flexShrink: 0,
          borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          background: "rgba(255,255,255,0.01)",
          height: "100%",
        }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", color: "#fff" }}>Mensagens</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
              {conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingInbox ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
                A carregar...
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                <MessageSquare size={40} style={{ color: "rgba(255,255,255,0.12)", marginBottom: "1rem" }} />
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.87rem", lineHeight: "1.55", margin: 0 }}>
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
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "center",
                      width: "100%",
                      padding: "0.9rem 1.25rem",
                      background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                      borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {conv.partnerAvatar ? (
                        <img
                          src={conv.partnerAvatar}
                          alt={conv.partnerName}
                          style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }}
                        />
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
                        borderRadius: "50%", border: "2px solid #0f0f0f",
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.1rem" }}>
                        <span style={{ fontWeight: "600", color: "#fff", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {conv.partnerName}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", flexShrink: 0, marginLeft: "0.5rem" }}>
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      {conv.jobTitle && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.15rem" }}>
                          <Briefcase size={9} style={{ color: "#6366f1", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.7rem", color: "#a5b4fc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {conv.jobTitle}
                          </span>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
          {selectedConv ? (
            <>
              {/* Chat header */}
              <div style={{
                padding: "0.9rem 1.25rem",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", gap: "0.75rem",
                background: "rgba(255,255,255,0.02)", flexShrink: 0,
              }}>
                {isMobile && (
                  <button
                    onClick={() => setSelectedConv(null)}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "0.25rem", display: "flex", alignItems: "center" }}
                  >
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
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: "700", color: "#fff" }}>
                    {selectedConv.partnerName}
                  </h3>
                  {selectedConv.jobTitle && (
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#a5b4fc", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Briefcase size={9} />
                      {selectedConv.jobTitle}
                    </p>
                  )}
                </div>
                {selectedConv.partnerRole && (
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                    <Clock size={10} />
                    {selectedConv.partnerRole}
                  </span>
                )}
              </div>

              {/* Messages area */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem",
                display: "flex", flexDirection: "column", gap: "0.6rem",
                background: "rgba(255,255,255,0.005)",
              }}>
                {loadingMessages && messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                    A carregar mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", textAlign: "center", gap: "0.75rem", padding: "2rem" }}>
                    <MessageSquare size={44} style={{ opacity: 0.2 }} />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>
                      Inicie a conversa com {selectedConv.partnerName}!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.fromUserId === user.id;
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "72%",
                          padding: "0.7rem 1rem",
                          borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: isMe ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.07)",
                          border: isMe ? "none" : "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                        }}>
                          <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: "1.45", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                            {msg.content}
                          </p>
                          <span style={{ display: "block", fontSize: "0.67rem", marginTop: "0.3rem", opacity: 0.55, textAlign: "right" }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: "0.9rem 1.25rem",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", gap: "0.6rem",
                  background: "rgba(255,255,255,0.02)", flexShrink: 0,
                }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Mensagem para ${selectedConv.partnerName}...`}
                  style={{
                    flex: 1, padding: "0.7rem 1rem",
                    borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)", color: "#fff",
                    fontSize: "0.88rem", outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  style={{
                    width: "42px", height: "42px", borderRadius: "12px", border: "none",
                    background: inputText.trim() ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(255,255,255,0.07)",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: inputText.trim() ? "pointer" : "not-allowed", flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            /* No conversation selected — desktop empty state */
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.25)", textAlign: "center", gap: "1rem",
            }}>
              <MessageSquare size={56} style={{ opacity: 0.12 }} />
              <div>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: "600", color: "rgba(255,255,255,0.35)" }}>
                  Selecione uma conversa
                </p>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.83rem", color: "rgba(255,255,255,0.2)" }}>
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
