const translations = {
    pt: {
        appName: "FlexJob",
        tagline: "Trabalho flexível ao teu ritmo",
        searchPlaceholder: "Procurar tarefas em Portugal...",
        filterAll: "Todas as categorias",
        filterDelivery: "Entregas",
        filterRetail: "Retalho & Lojas",
        filterLogistics: "Logística & Armazém",
        filterCleaning: "Limpezas & Doméstico",
        filterRestoration: "Restauração & Eventos",
        filterOthers: "Outros Serviços",
        btnPostJob: "Publicar Tarefa",
        btnMyJobs: "As Minhas Tarefas",
        btnMessages: "Mensagens",
        btnProfile: "Perfil",
        btnAvailability: "Estou Disponível",
        btnApply: "Candidatar-me",
        btnApplied: "Candidatado",
        btnComplete: "Marcar como Concluído",
        btnRegister: "Criar Conta",
        btnLogin: "Entrar",
        btnLogout: "Terminar Sessão",
        roleWorker: "Trabalhador",
        roleEmployer: "Contratante",
        lblHourly: "por hora",
        lblFixed: "fixo",
        lblDuration: "Duração estimada",
        lblAddress: "Endereço",
        lblCompensation: "Remuneração",
        lblCategory: "Categoria",
        lblDescription: "Descrição",
        lblTitle: "Título da Tarefa",
        lblAvailabilitySettings: "Configurar Disponibilidade Proativa",
        lblAvailabilityRadius: "Raio de trabalho (km)",
        lblHourlyRate: "Preço por hora (€/h)",
        lblSkills: "Habilidades / Resumo",
        lblActiveAvailability: "Disponibilidade ativa no mapa",
        lblChatWith: "Conversa com",
        lblPlaceholderChat: "Escreve uma mensagem...",
        lblRating: "Avaliação",
        lblApplicants: "Candidaturas Recebidas",
        lblAccept: "Aceitar",
        lblReject: "Recusar",
        statusOpen: "Aberto",
        statusAccepted: "Em progresso",
        statusCompleted: "Concluído",
        txtNoJobs: "Nenhuma tarefa encontrada nesta área.",
        txtNoMessages: "Seleciona uma tarefa ativa para abrir o chat.",
        txtCreateAccount: "Ainda não tens conta? Regista-te",
        txtHaveAccount: "Já tens conta? Inicia sessão",
        txtWelcomeBack: "Bem-vindo de volta!",
        txtJoinFlexJob: "Junta-te ao FlexJob",
        txtSmenaStyle: "Encontra ajuda ou ganha dinheiro extra em minutos, perto de ti. Sem entrevistas, sem currículos, com pagamento seguro.",
        alertSuccessJob: "Tarefa publicada com sucesso!",
        alertSuccessApply: "Candidatura enviada com sucesso!",
        alertSuccessAvailability: "Disponibilidade atualizada!",
        alertError: "Ocorreu um erro. Tenta novamente.",
        txtPlaceholderBio: "Escreve uma breve apresentação sobre ti...",
        lblSaveProfile: "Guardar Alterações",
        txtActiveWorkers: "Trabalhadores ativos",
        txtOpenTasks: "Tarefas disponíveis",
        txtSelectLocationOnMap: "Clica no mapa para definir a localização exata da tarefa",
        lblDirectContact: "Contacto Direto",
        lblReviews: "Avaliações Recebidas",
        txtNoReviews: "Ainda não tens avaliações."
    },
    en: {
        appName: "FlexJob",
        tagline: "Flexible work at your own pace",
        searchPlaceholder: "Search tasks in Portugal...",
        filterAll: "All categories",
        filterDelivery: "Delivery",
        filterRetail: "Retail & Shops",
        filterLogistics: "Logistics & Warehouse",
        filterCleaning: "Cleaning & Domestic",
        filterRestoration: "Restoration & Events",
        filterOthers: "Other Services",
        btnPostJob: "Post a Job",
        btnMyJobs: "My Tasks",
        btnMessages: "Messages",
        btnProfile: "Profile",
        btnAvailability: "I am Available",
        btnApply: "Apply to Gig",
        btnApplied: "Applied",
        btnComplete: "Mark as Completed",
        btnRegister: "Register",
        btnLogin: "Log In",
        btnLogout: "Log Out",
        roleWorker: "Worker",
        roleEmployer: "Employer",
        lblHourly: "hourly",
        lblFixed: "fixed",
        lblDuration: "Estimated duration",
        lblAddress: "Address",
        lblCompensation: "Compensation",
        lblCategory: "Category",
        lblDescription: "Description",
        lblTitle: "Job Title",
        lblAvailabilitySettings: "Configure Proactive Availability",
        lblAvailabilityRadius: "Working radius (km)",
        lblHourlyRate: "Hourly rate (€/h)",
        lblSkills: "Skills / Summary",
        lblActiveAvailability: "Active availability on map",
        lblChatWith: "Chat with",
        lblPlaceholderChat: "Type a message...",
        lblRating: "Rating",
        lblApplicants: "Applications Received",
        lblAccept: "Accept",
        lblReject: "Reject",
        statusOpen: "Open",
        statusAccepted: "In progress",
        statusCompleted: "Completed",
        txtNoJobs: "No tasks found in this area.",
        txtNoMessages: "Select an active task to open the chat.",
        txtCreateAccount: "Don't have an account? Sign up",
        txtHaveAccount: "Already have an account? Log in",
        txtWelcomeBack: "Welcome back!",
        txtJoinFlexJob: "Join FlexJob",
        txtSmenaStyle: "Find help or make extra money in minutes, near you. No interviews, no resumes, with secure payment.",
        alertSuccessJob: "Task posted successfully!",
        alertSuccessApply: "Application sent successfully!",
        alertSuccessAvailability: "Availability updated!",
        alertError: "An error occurred. Please try again.",
        txtPlaceholderBio: "Write a short presentation about yourself...",
        lblSaveProfile: "Save Changes",
        txtActiveWorkers: "Active workers",
        txtOpenTasks: "Available tasks",
        txtSelectLocationOnMap: "Click on the map to define the exact location of the task",
        lblDirectContact: "Direct Contact",
        lblReviews: "Reviews Received",
        txtNoReviews: "You don't have any reviews yet."
    }
};

let currentLanguage = localStorage.getItem("flexjob_lang") || "pt";

function setLanguage(lang) {
    if (lang !== "pt" && lang !== "en") return;
    currentLanguage = lang;
    localStorage.setItem("flexjob_lang", lang);
    updateLanguageDOM();
}

function t(key) {
    return translations[currentLanguage][key] || key;
}

function updateLanguageDOM() {
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        if (translations[currentLanguage][key]) {
            if (element.tagName === "INPUT" && (element.type === "text" || element.type === "password" || element.type === "email" || element.type === "search")) {
                element.placeholder = translations[currentLanguage][key];
            } else if (element.tagName === "TEXTAREA") {
                element.placeholder = translations[currentLanguage][key];
            } else {
                element.innerText = translations[currentLanguage][key];
            }
        }
    });

    // Update active state of language toggle buttons if they exist
    const btnPt = document.getElementById("btn-lang-pt");
    const btnEn = document.getElementById("btn-lang-en");
    if (btnPt && btnEn) {
        if (currentLanguage === "pt") {
            btnPt.classList.add("active");
            btnEn.classList.remove("active");
        } else {
            btnPt.classList.remove("active");
            btnEn.classList.add("active");
        }
    }
}

// Call on load
document.addEventListener("DOMContentLoaded", () => {
    updateLanguageDOM();
});
