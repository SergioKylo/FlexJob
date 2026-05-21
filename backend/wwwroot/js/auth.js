const Auth = {
    user: null,

    async checkSession() {
        try {
            const response = await fetch("/api/auth/me");
            if (response.ok) {
                this.user = await response.json();
                this.onAuthStateChanged();
                return true;
            }
        } catch (error) {
            console.error("Session check failed:", error);
        }
        this.user = null;
        this.onAuthStateChanged();
        return false;
    },

    async register(name, email, password, role) {
        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role })
            });
            const data = await response.json();
            if (response.ok) {
                showToast(t("alertSuccessJob") || data.message, "success");
                return { success: true };
            } else {
                showToast(data.message || t("alertError"), "error");
                return { success: false, message: data.message };
            }
        } catch (error) {
            showToast(t("alertError"), "error");
            return { success: false, message: error.message };
        }
    },

    async login(email, password) {
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                this.user = data;
                this.onAuthStateChanged();
                showToast(t("txtWelcomeBack"), "success");
                return { success: true };
            } else {
                showToast(data.message || t("alertError"), "error");
                return { success: false, message: data.message };
            }
        } catch (error) {
            showToast(t("alertError"), "error");
            return { success: false, message: error.message };
        }
    },

    async logout() {
        try {
            const response = await fetch("/api/auth/logout", { method: "POST" });
            if (response.ok) {
                this.user = null;
                this.onAuthStateChanged();
                showToast(t("btnLogout"), "success");
                return true;
            }
        } catch (error) {
            console.error("Logout failed:", error);
        }
        return false;
    },

    onAuthStateChanged() {
        const event = new CustomEvent("authStateChanged", { detail: this.user });
        window.dispatchEvent(event);
    }
};

// Global Toast notification utility
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    // Auto-remove toast
    setTimeout(() => {
        toast.style.animation = "slideDown 0.3s ease reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
