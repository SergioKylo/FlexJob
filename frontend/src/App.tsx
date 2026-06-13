import { useEffect, useMemo, useRef, useState } from "react";
import { Globe2, LogOut, Map, Briefcase, Users, MessageSquare, Wallet, User, Sun, Moon, Euro } from "lucide-react";
import { translations, type TranslationKey } from "./i18n/translations";
import { ToastContainer } from "./components/ToastContainer";
import { NotificationBell, type NotificationItem } from "./components/NotificationBell";
import { toast } from "./utils/toast";
import { WorkersPage } from "./pages/WorkersPage";
import { JobsPage } from "./pages/JobsPage";
import { LandingPage } from "./pages/LandingPage";
import { MapPage } from "./pages/MapPage";
import { MessagesPage } from "./pages/MessagesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { WalletPage } from "./pages/WalletPage";
import { AdminPage } from "./pages/AdminPage";
import type { AppView, Language, MatchRecord, Opportunity, User as UserType, WorkMode } from "./types";
import { api } from "./utils/api";
import { ChatModal } from "./components/ChatModal";

const VIEW_ICONS: Record<AppView, JSX.Element> = {
  map:      <Map size={18} />,
  jobs:     <Briefcase size={18} />,
  workers:  <Users size={18} />,
  messages: <MessageSquare size={18} />,
  wallet:   <Wallet size={18} />,
  profile:  <User size={18} />,
};

export function App() {
  const [language, setLanguage] = useState<Language>("pt");
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("fj-theme") as "dark" | "light") || "dark");
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>("map");
  const [mode, setMode] = useState<WorkMode>("need");
  const [needs, setNeeds] = useState<Opportunity[]>([]);
  const [workers, setWorkers] = useState<Opportunity[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [activeChat, setActiveChat] = useState<{
    partnerId: number;
    partnerName: string;
    partnerAvatar?: string;
    jobId?: number;
  } | null>(null);

  const t = (key: TranslationKey) => translations[language][key];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fj-theme", theme);
  }, [theme]);

  const allItems = useMemo(() => [...needs, ...workers], [needs, workers]);

  // Check session on mount
  useEffect(() => {
    api.me()
      .then((loggedInUser) => {
        setUser(loggedInUser);
        setMode(loggedInUser.role === "employer" ? "work" : "need");
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Refresh wallet balance in topbar — periodically and right after payments
  const refreshWallet = () =>
    api.getWallet()
      .then((w) => setUser((prev) => prev ? { ...prev, walletBalance: w.balance } : prev))
      .catch(() => {});

  useEffect(() => {
    if (!user) return;
    refreshWallet();
    const id = setInterval(refreshWallet, 8000);
    return () => clearInterval(id);
  }, [user?.id]);

  // Notification feed (bell) + top-right toast when a new message arrives
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLastSeen, setNotifLastSeen] = useState<string>(() => localStorage.getItem("flexjob_notif_seen") || "");
  const [messagesTarget, setMessagesTarget] = useState<{ partnerId: number; partnerName: string; partnerAvatar?: string; jobId?: number } | null>(null);

  function markNotificationsSeen() {
    const now = new Date().toISOString();
    setNotifLastSeen(now);
    localStorage.setItem("flexjob_notif_seen", now);
  }

  useEffect(() => {
    if (!user) return;
    const lastTimes: Record<string, string> = {};
    let first = true;
    const check = () =>
      api.getInbox()
        .then((convs) => {
          const items: NotificationItem[] = [];
          convs.forEach((c) => {
            const key = `${c.partnerId}-${c.jobId}`;
            const isAdmin = c.partnerRole === "admin";
            const preview = c.lastMessage?.startsWith("{") ? `📋 ${t("chatProposalTitle")}` : (c.lastMessage ?? "");
            if (c.lastFromUserId !== user.id) {
              items.push({
                key,
                partnerId: c.partnerId,
                partnerName: isAdmin ? "Administração FlexJob" : c.partnerName,
                partnerAvatar: c.partnerAvatar,
                jobId: c.jobId,
                jobTitle: c.jobTitle,
                preview: isAdmin ? `⚠ ${preview}` : preview,
                time: c.lastMessageTime,
                isAdmin,
              });
            }
            const prev = lastTimes[key];
            const isNew = !first && (!prev || c.lastMessageTime > prev);
            if (isNew && c.lastFromUserId !== user.id && viewRef.current !== "messages") {
              if (isAdmin) toast.error(`⚠ Aviso da administração: ${preview.slice(0, 70)}`);
              else toast.info(`💬 ${c.partnerName}: ${preview.slice(0, 70)}`);
            }
            lastTimes[key] = c.lastMessageTime;
          });
          items.sort((a, b) => (a.time < b.time ? 1 : -1));
          setNotifications(items.slice(0, 15));
          first = false;
        })
        .catch(() => {});
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, [user?.id]);

  // Fetch jobs / workers when user or view changes
  useEffect(() => {
    if (!user) return;

    if (user.role === "employer") {
      api.getWorkers(user.lat, user.lng)
        .then((data) => setWorkers(data))
        .catch((err) => console.error("Error loading workers:", err));

      api.getMyJobs()
        .then((data) => {
          setMatches(data.map((j) => ({
            id: j.id,
            itemId: j.id,
            mode: "need" as WorkMode,
            title: j.title,
            city: j.address || "Local",
            pay: j.pay,
            createdAt: new Date(j.createdAt).toLocaleDateString(),
            status: j.status,
          })));
        })
        .catch((err) => console.error("Error loading employer jobs:", err));
    } else {
      api.getJobs(user.lat, user.lng)
        .then((data) => setNeeds(data))
        .catch((err) => console.error("Error loading jobs:", err));

      api.getMyJobs()
        .then((data) => {
          setMatches(data.map((j) => ({
            id: j.id,
            itemId: j.id,
            mode: "work" as WorkMode,
            title: j.title,
            city: j.address || "Local",
            pay: j.pay,
            createdAt: new Date(j.createdAt).toLocaleDateString(),
            status: j.status,
          })));
        })
        .catch((err) => console.error("Error loading worker jobs:", err));
    }
  }, [user?.id]);

  function handleLogin(nextUser: UserType) {
    setUser(nextUser);
    setMode(nextUser.role === "employer" ? "work" : "need");
    setView("map");
  }

  async function handleLogout() {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
    setView("map");
  }

  async function createMatch(item: Opportunity) {
    if (!user) return;
    try {
      if (user.role === "worker") {
        await api.applyToJob(item.id);
        const data = await api.getMyJobs();
        setMatches(data.map((j) => ({
          id: j.id, itemId: j.id, mode: "work" as WorkMode,
          title: j.title, city: j.address || "Local", pay: j.pay,
          createdAt: new Date(j.createdAt).toLocaleDateString(),
        })));
        // Auto-open chat with employer after applying
        const employerId = item.employerId ?? 0;
        if (employerId > 0) {
          openChat(employerId, item.requester, undefined, item.id);
          setView("messages");
        }
      } else {
        // Employer invites a worker → open chat
        openChat(item.id, item.title, `https://api.dicebear.com/7.x/bottts/svg?seed=${item.title}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao efetuar a candidatura.");
    }
  }

  function openChat(partnerId: number, partnerName: string, partnerAvatar?: string, jobId?: number) {
    setActiveChat({ partnerId, partnerName, partnerAvatar, jobId });
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "1.2rem", fontWeight: "bold" }}>
        {t("loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ToastContainer />
        <LandingPage
          language={language}
          onLanguageChange={setLanguage}
          onLogin={handleLogin}
          t={t}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      </>
    );
  }

  // Admin gets a completely separate layout
  if (user.role === "admin") {
    return (
      <>
        <ToastContainer />
        <AdminPage
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      </>
    );
  }

  const allowedViews: AppView[] = user.role === "worker"
    ? ["map", "jobs", "messages", "wallet", "profile"]
    : ["map", "workers", "messages", "wallet", "profile"];

  const pages: Record<AppView, JSX.Element> = {
    map: (
      <MapPage
        mode={mode}
        needs={needs}
        workers={workers}
        matches={matches}
        onCreateMatch={createMatch}
        onModeChange={setMode}
        t={t}
        user={user}
        onRefresh={() => setView("map")}
        onStartChat={(pId, pName, pAvatar, jId) => openChat(pId, pName, pAvatar, jId)}
      />
    ),
    jobs: (
      <JobsPage
        needs={needs}
        matches={matches}
        t={t}
        user={user}
        onCreateMatch={createMatch}
        onStartChat={(pId, pName, pAvatar, jId) => openChat(pId, pName, pAvatar, jId)}
      />
    ),
    workers: (
      <WorkersPage
        workers={workers}
        t={t}
        user={user}
        employerJobs={matches.filter((m) => m.status === "open")}
        onStartChat={(pId, pName, pAvatar, jId) => openChat(pId, pName, pAvatar, jId)}
      />
    ),
    messages: (
      <MessagesPage
        key={messagesTarget ? `${messagesTarget.partnerId}-${messagesTarget.jobId ?? 0}` : "inbox"}
        user={user}
        onWalletRefresh={refreshWallet}
        t={t}
        initialPartnerId={messagesTarget?.partnerId}
        initialPartnerName={messagesTarget?.partnerName}
        initialPartnerAvatar={messagesTarget?.partnerAvatar}
        initialJobId={messagesTarget?.jobId}
      />
    ),
    wallet:   <WalletPage t={t} />,
    profile:  <ProfilePage t={t} user={user} onUserUpdate={(updated) => setUser((prev) => prev ? { ...prev, ...updated } : prev)} />,
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand reset-button" onClick={() => setView("map")}>
          <span className="brand-mark">FJ</span>
          <span>FlexJob</span>
        </button>

        <nav className="topnav" aria-label="Main navigation">
          {allowedViews.map((item) => (
            <button
              className={`nav-pill ${view === item ? "active" : ""}`}
              key={item}
              onClick={() => setView(item)}
            >
              {t(item as TranslationKey)}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          {/* Wallet balance pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.3rem",
            padding: "0.3rem 0.75rem", borderRadius: "20px",
            background: user.role === "worker" ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
            border: `1px solid ${user.role === "worker" ? "rgba(16,185,129,0.3)" : "rgba(99,102,241,0.3)"}`,
          }}>
            <Euro size={12} style={{ color: user.role === "worker" ? "#10b981" : "#6366f1" }} />
            <span style={{ fontSize: "0.82rem", fontWeight: "800", color: user.role === "worker" ? "#10b981" : "#6366f1" }}>
              {(user.walletBalance ?? 0).toFixed(2)}
            </span>
          </div>
          <NotificationBell
            notifications={notifications}
            lastSeen={notifLastSeen}
            onMarkSeen={markNotificationsSeen}
            onSelect={(n) => {
              setMessagesTarget({ partnerId: n.partnerId, partnerName: n.partnerName, partnerAvatar: n.partnerAvatar, jobId: n.jobId > 0 ? n.jobId : undefined });
              setView("messages");
            }}
            emptyLabel={t("noNotifications")}
          />
          <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-button" onClick={() => setLanguage(language === "pt" ? "en" : "pt")} aria-label="Switch language">
            <Globe2 size={18} />
            {language.toUpperCase()}
          </button>
          <button className="secondary small" onClick={handleLogout}>
            <LogOut size={16} />
            {t("logout")}
          </button>
        </div>
      </header>

      <main>{pages[view]}</main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {allowedViews.map((item) => (
          <button
            className={`bottom-item ${view === item ? "active" : ""}`}
            key={item}
            onClick={() => setView(item)}
          >
            {VIEW_ICONS[item]}
            <small>{t(item as TranslationKey)}</small>
          </button>
        ))}
      </nav>

      <ToastContainer />

      {activeChat && (
        <ChatModal
          partnerId={activeChat.partnerId}
          partnerName={activeChat.partnerName}
          partnerAvatar={activeChat.partnerAvatar}
          jobId={activeChat.jobId}
          onClose={() => setActiveChat(null)}
          currentUser={user}
          t={t}
        />
      )}
    </div>
  );
}
