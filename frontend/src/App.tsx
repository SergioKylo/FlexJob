import { useEffect, useMemo, useState } from "react";
import { Briefcase, Globe2, LogOut } from "lucide-react";
import { translations, type TranslationKey } from "./i18n/translations";
import { WorkersPage } from "./pages/WorkersPage";
import { JobsPage } from "./pages/JobsPage";
import { LandingPage } from "./pages/LandingPage";
import { MapPage } from "./pages/MapPage";
import { ProfilePage } from "./pages/ProfilePage";
import { WalletPage } from "./pages/WalletPage";
import type { AppView, Language, MatchRecord, Opportunity, User, WorkMode } from "./types";
import { api } from "./utils/api";
import { ChatModal } from "./components/ChatModal";

export function App() {
  const [language, setLanguage] = useState<Language>("pt");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>("map");
  const [mode, setMode] = useState<WorkMode>("need");
  const [needs, setNeeds] = useState<Opportunity[]>([]);
  const [workers, setWorkers] = useState<Opportunity[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [activeChat, setActiveChat] = useState<{ partnerId: number; partnerName: string; partnerAvatar?: string; jobId?: number } | null>(null);

  const t = (key: TranslationKey) => translations[language][key];

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

  // Fetch jobs / workers when user or view changes
  useEffect(() => {
    if (!user) return;

    if (user.role === "employer") {
      // Employer views available workers
      api.getWorkers(user.lat, user.lng)
        .then((data) => setWorkers(data))
        .catch((err) => console.error("Error loading workers:", err));
      
      // Also fetch employer's own jobs to display in matches/jobs lists
      api.getMyJobs()
        .then((data) => {
          const parsedMatches = data.map((j) => ({
            id: j.id,
            itemId: j.id,
            mode: "need" as WorkMode,
            title: j.title,
            city: j.address || "Local",
            pay: j.pay,
            createdAt: new Date(j.createdAt).toLocaleDateString(),
          }));
          setMatches(parsedMatches);
        })
        .catch((err) => console.error("Error loading employer jobs:", err));
    } else {
      // Worker views available jobs
      api.getJobs(user.lat, user.lng)
        .then((data) => setNeeds(data))
        .catch((err) => console.error("Error loading jobs:", err));

      // Also fetch worker's own jobs/applications
      api.getMyJobs()
        .then((data) => {
          const parsedMatches = data.map((j) => ({
            id: j.id,
            itemId: j.id,
            mode: "work" as WorkMode,
            title: j.title,
            city: j.address || "Local",
            pay: j.pay,
            createdAt: new Date(j.createdAt).toLocaleDateString(),
          }));
          setMatches(parsedMatches);
        })
        .catch((err) => console.error("Error loading worker jobs:", err));
    }
  }, [user, view]);

  function handleLogin(nextUser: User) {
    setUser(nextUser);
    setMode(nextUser.role === "employer" ? "work" : "need");
    setView("map");
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
    setView("map");
  }

  async function createMatch(item: Opportunity) {
    if (!user) return;
    try {
      if (user.role === "worker") {
        // Worker applies to a job
        await api.applyToJob(item.id);
        alert("Candidatura enviada com sucesso!");
        // Refresh matches
        const data = await api.getMyJobs();
        const parsedMatches = data.map((j) => ({
          id: j.id,
          itemId: j.id,
          mode: "work" as WorkMode,
          title: j.title,
          city: j.address || "Local",
          pay: j.pay,
          createdAt: new Date(j.createdAt).toLocaleDateString(),
        }));
        setMatches(parsedMatches);
      } else {
        // Employer invites a worker (mock matching for now or custom logic)
        alert(`Trabalhador ${item.title} convidado!`);
      }
    } catch (err: any) {
      alert(err.message || "Erro ao efetuar a candidatura.");
    }
  }

  if (loading) {
    return <div className="loading-screen" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "1.2rem", fontWeight: "bold" }}>A carregar o FlexJob...</div>;
  }

  if (!user) {
    return <SidebarLayout language={language} onLanguageChange={setLanguage} onLogin={handleLogin} t={t} />;
  }

  const pages = {
    map: <MapPage mode={mode} needs={needs} workers={workers} matches={matches} onCreateMatch={createMatch} onModeChange={setMode} t={t} user={user} onRefresh={() => setView("map")} onStartChat={(pId, pName, pAvatar, jId) => setActiveChat({ partnerId: pId, partnerName: pName, partnerAvatar: pAvatar, jobId: jId })} />,
    jobs: <JobsPage needs={needs} matches={matches} t={t} onCreateMatch={createMatch} onStartChat={(pId, pName, pAvatar, jId) => setActiveChat({ partnerId: pId, partnerName: pName, partnerAvatar: pAvatar, jobId: jId })} />,
    workers: <WorkersPage workers={workers} t={t} user={user} onStartChat={(pId, pName, pAvatar) => setActiveChat({ partnerId: pId, partnerName: pName, partnerAvatar: pAvatar })} />,
    wallet: <WalletPage t={t} />,
    profile: <ProfilePage t={t} user={user} />,
  } satisfies Record<AppView, JSX.Element>;

  const allowedViews: AppView[] = user.role === "worker"
    ? ["map", "jobs", "wallet", "profile"]
    : ["map", "workers", "wallet", "profile"];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand reset-button" onClick={() => setView("map")}>
          <span className="brand-mark">FJ</span>
          <span>FlexJob</span>
        </button>

        <nav className="topnav" aria-label="Main navigation">
          {allowedViews.map((item) => (
            <button className={`nav-pill ${view === item ? "active" : ""}`} key={item} onClick={() => setView(item)}>
              {t(item)}
            </button>
          ))}
        </nav>

        <div className="top-actions">
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
          <button className={`bottom-item ${view === item ? "active" : ""}`} key={item} onClick={() => setView(item)}>
            <Briefcase size={18} />
            <small>{t(item)}</small>
          </button>
        ))}
      </nav>

      {activeChat && (
        <ChatModal
          partnerId={activeChat.partnerId}
          partnerName={activeChat.partnerName}
          partnerAvatar={activeChat.partnerAvatar}
          jobId={activeChat.jobId}
          onClose={() => setActiveChat(null)}
          currentUser={user}
        />
      )}
    </div>
  );
}

// Helper wrapper component for landing page to avoid missing exports
function SidebarLayout(props: any) {
  return <LandingPage {...props} />;
}
