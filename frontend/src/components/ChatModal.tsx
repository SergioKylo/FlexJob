import { useEffect, useRef, useState } from "react";
import { Send, X, MessageCircle } from "lucide-react";
import { api } from "../utils/api";
import type { ChatMessage, User } from "../types";

interface ChatModalProps {
  partnerId: number;
  partnerName: string;
  partnerAvatar?: string;
  jobId?: number;
  onClose: () => void;
  currentUser: User;
}

export function ChatModal({
  partnerId,
  partnerName,
  partnerAvatar,
  jobId,
  onClose,
  currentUser,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
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
      alert("Não foi possível enviar a mensagem.");
    }
  }

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="chat-modal-overlay">
      <div className="chat-modal-container">
        {/* Header */}
        <header className="chat-modal-header">
          <div className="chat-partner-info">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt={partnerName} className="chat-avatar" />
            ) : (
              <div className="chat-avatar-fallback">{getInitials(partnerName)}</div>
            )}
            <div>
              <h3 className="chat-partner-name">{partnerName}</h3>
              <p className="chat-status-indicator">
                <span className="online-dot"></span> Online
              </p>
            </div>
          </div>
          <button className="chat-close-button reset-button" onClick={onClose} aria-label="Fechar Chat">
            <X size={20} />
          </button>
        </header>

        {/* Message area */}
        <main className="chat-messages-container">
          {loading && messages.length === 0 ? (
            <div className="chat-messages-loading">
              <span className="spinner"></span> A carregar mensagens...
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-no-messages">
              <MessageCircle size={48} className="chat-empty-icon" />
              <p>Inicie a conversa! Envie uma mensagem para {partnerName}.</p>
            </div>
          ) : (
            <div className="chat-message-list">
              {messages.map((msg) => {
                const isMe = msg.fromUserId === currentUser.id;
                const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
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
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escreva uma mensagem..."
              className="chat-text-input"
              autoFocus
            />
            <button type="submit" className="chat-send-button" disabled={!inputText.trim()}>
              <Send size={18} />
            </button>
          </form>
        </footer>
      </div>

      <style>{`
        .chat-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(20, 21, 17, 0.4);
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
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid var(--line, #dde2d8);
          border-radius: 24px;
          box-shadow: var(--shadow, 0 18px 50px rgba(31, 36, 24, 0.14));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .chat-modal-header {
          padding: 16px 20px;
          background: #ffffff;
          border-bottom: 1px solid var(--line, #dde2d8);
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          border: 2px solid var(--yellow, #ffd233);
        }

        .chat-avatar-fallback {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--yellow, #ffd233);
          color: var(--ink, #141511);
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          border: 2px solid var(--line, #dde2d8);
        }

        .chat-partner-name {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--ink, #141511);
        }

        .chat-status-indicator {
          margin: 2px 0 0 0;
          font-size: 0.75rem;
          color: var(--muted, #686d63);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .online-dot {
          width: 6px;
          height: 6px;
          background: var(--green, #1d8b5f);
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
          color: var(--muted, #686d63);
          background: #f3f5f2;
          transition: all 0.2s;
        }

        .chat-close-button:hover {
          color: var(--ink, #141511);
          background: var(--line, #dde2d8);
        }

        .chat-messages-container {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: #f9faf8;
          display: flex;
          flex-direction: column;
        }

        .chat-messages-loading,
        .chat-no-messages {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--muted, #686d63);
          padding: 32px;
        }

        .chat-empty-icon {
          color: var(--line, #dde2d8);
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
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          position: relative;
        }

        .chat-message-bubble-wrapper.me .chat-message-bubble {
          background: var(--ink, #141511);
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .chat-message-bubble-wrapper.them .chat-message-bubble {
          background: #ffffff;
          color: var(--ink, #141511);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--line, #dde2d8);
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
          opacity: 0.7;
        }

        .chat-message-bubble-wrapper.me .chat-message-time {
          color: rgba(255, 255, 255, 0.7);
        }

        .chat-message-bubble-wrapper.them .chat-message-time {
          color: var(--muted, #686d63);
        }

        .chat-modal-footer {
          padding: 16px 20px;
          background: #ffffff;
          border-top: 1px solid var(--line, #dde2d8);
        }

        .chat-input-form {
          display: flex;
          gap: 12px;
        }

        .chat-text-input {
          flex: 1;
          height: 44px;
          padding: 0 16px;
          border: 1px solid var(--line, #dde2d8);
          border-radius: 14px;
          outline: none;
          font-size: 0.95rem;
          background: #f9faf8;
          transition: all 0.2s;
        }

        .chat-text-input:focus {
          border-color: var(--ink, #141511);
          background: #ffffff;
        }

        .chat-send-button {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--yellow, #ffd233);
          color: var(--ink, #141511);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          border: none;
        }

        .chat-send-button:hover:not(:disabled) {
          background: var(--yellow-dark, #efb900);
          transform: translateY(-1px);
        }

        .chat-send-button:disabled {
          background: var(--line, #dde2d8);
          color: var(--muted, #686d63);
          cursor: not-allowed;
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
