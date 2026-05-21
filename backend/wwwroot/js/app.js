let map;
let jobsLayer;
let workersLayer;
let selectedCoordinates = null;
let currentChatInterval = null;
let activeChatJobId = null;
let activeChatPartnerId = null;

// Default map view centered in Lisbon
const defaultCenter = [38.7223, -9.1393];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Listen to Auth State Changes
window.addEventListener("authStateChanged", (e) => {
    const user = e.detail;
    updateUIForUser(user);
});

function initApp() {
    // Check initial language active state
    updateLanguageDOM();

    // Setup map
    initMap();

    // Check login state
    Auth.checkSession().then(isLoggedIn => {
        if (!isLoggedIn) {
            showView("landing");
        } else {
            showView("app");
            loadMapData();
            loadJobsFeed();
        }
    });

    // Wire up events
    setupEventListeners();
}

function initMap() {
    if (typeof L === 'undefined') {
        console.warn("Leaflet map library is not loaded yet.");
        return;
    }
    if (map) return;

    try {
        map = L.map("map", {
            zoomControl: false
        }).setView(defaultCenter, 13);

        // Zoom control position bottom-right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        jobsLayer = L.layerGroup().addTo(map);
        workersLayer = L.layerGroup().addTo(map);

        // Click on map action
        map.on("click", (e) => {
            const { lat, lng } = e.latlng;
            selectedCoordinates = { lat, lng };

            // Handle job location selection
            const postJobModal = document.getElementById("post-job-modal");
            if (postJobModal && !postJobModal.classList.contains("hidden")) {
                updateSelectedLocationMarker(lat, lng);
            }

            // Handle availability location selection
            const availPanel = document.getElementById("availability-panel");
            if (availPanel && !availPanel.classList.contains("hidden")) {
                updateAvailabilityLocationMarker(lat, lng);
            }
        });
    } catch (error) {
        console.error("Failed to initialize Leaflet map:", error);
    }
}

let placementMarker = null;
function updateSelectedLocationMarker(lat, lng) {
    if (placementMarker) {
        placementMarker.setLatLng([lat, lng]);
    } else {
        const orangeIcon = L.divIcon({
            html: '<div class="marker-pin-wrapper"><div class="marker-pin-icon" style="background:#ff6b00"></div></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        });
        placementMarker = L.marker([lat, lng], { icon: orangeIcon }).addTo(map);
    }
    // Update address coordinates inputs
    document.getElementById("post-lat").value = lat.toFixed(6);
    document.getElementById("post-lng").value = lng.toFixed(6);
    reverseGeocode(lat, lng, "post-address");
}

let availabilityPlacementMarker = null;
let availabilityRadiusCircle = null;
function updateAvailabilityLocationMarker(lat, lng) {
    if (availabilityPlacementMarker) {
        availabilityPlacementMarker.setLatLng([lat, lng]);
    } else {
        const greenIcon = L.divIcon({
            html: `<div class="marker-pin-wrapper"><div class="marker-pin-worker"><img src="${Auth.user.avatar}" /></div></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
        availabilityPlacementMarker = L.marker([lat, lng], { icon: greenIcon }).addTo(map);
    }

    const radius = parseFloat(document.getElementById("avail-radius").value) || 2;
    updateAvailabilityCircle(lat, lng, radius);
}

function updateAvailabilityCircle(lat, lng, radiusKm) {
    if (availabilityRadiusCircle) {
        availabilityRadiusCircle.setLatLng([lat, lng]);
        availabilityRadiusCircle.setRadius(radiusKm * 1000);
    } else {
        availabilityRadiusCircle = L.circle([lat, lng], {
            color: '#ff6b00',
            fillColor: '#ff6b00',
            fillOpacity: 0.15,
            radius: radiusKm * 1000
        }).addTo(map);
    }
}

// Simple reverse geocoding mock / basic logic
async function reverseGeocode(lat, lng, elementId) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById(elementId).value = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    } catch {
        document.getElementById(elementId).value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

function setupEventListeners() {
    // Navigation / View Switchers
    document.getElementById("btn-lang-pt").addEventListener("click", () => setLanguage("pt"));
    document.getElementById("btn-lang-en").addEventListener("click", () => setLanguage("en"));

    // Forms
    document.getElementById("auth-login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-pass").value;
        const res = await Auth.login(email, pass);
        if (res.success) {
            showView("app");
            loadMapData();
            loadJobsFeed();
        }
    });

    document.getElementById("auth-register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const pass = document.getElementById("reg-pass").value;
        const roleOption = document.querySelector(".role-option.selected");
        const role = roleOption ? roleOption.getAttribute("data-role") : "worker";

        const res = await Auth.register(name, email, pass, role);
        if (res.success) {
            toggleAuthForm(false); // Switch to login
        }
    });

    // Profile settings save
    document.getElementById("profile-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("profile-name-input").value;
        const bio = document.getElementById("profile-bio-input").value;

        try {
            const response = await fetch("/api/users/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, bio })
            });

            if (response.ok) {
                const data = await response.json();
                Auth.user.name = name;
                Auth.user.bio = bio;
                if (data.avatar) {
                    Auth.user.avatar = data.avatar;
                }
                updateUIForUser(Auth.user);
                showToast(translations[currentLanguage]["alertSuccessAvailability"] || "Perfil guardado!", "success");
            } else {
                const err = await response.json();
                showToast(err.message, "error");
            }
        } catch {
            showToast(t("alertError"), "error");
        }
    });

    // Post job form
    document.getElementById("post-job-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("post-title").value;
        const desc = document.getElementById("post-desc").value;
        const category = document.getElementById("post-category").value;
        const lat = parseFloat(document.getElementById("post-lat").value);
        const lng = parseFloat(document.getElementById("post-lng").value);
        const address = document.getElementById("post-address").value;
        const pay = parseFloat(document.getElementById("post-pay").value);
        const payType = document.getElementById("post-pay-type").value;
        const duration = document.getElementById("post-duration").value;

        if (isNaN(lat) || isNaN(lng)) {
            showToast(t("txtSelectLocationOnMap"), "error");
            return;
        }

        try {
            const response = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description: desc, category, lat, lng, address, pay, payType, duration })
            });

            if (response.ok) {
                showToast(t("alertSuccessJob"), "success");
                closePostJobModal();
                loadMapData();
                loadJobsFeed();
            } else {
                const err = await response.json();
                showToast(err.message, "error");
            }
        } catch {
            showToast(t("alertError"), "error");
        }
    });

    // Set Availability form
    document.getElementById("availability-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!selectedCoordinates && !availabilityPlacementMarker) {
            showToast(t("txtSelectLocationOnMap"), "error");
            return;
        }
        const lat = selectedCoordinates ? selectedCoordinates.lat : availabilityPlacementMarker.getLatLng().lat;
        const lng = selectedCoordinates ? selectedCoordinates.lng : availabilityPlacementMarker.getLatLng().lng;
        const radius = parseFloat(document.getElementById("avail-radius").value);
        const rate = parseFloat(document.getElementById("avail-rate").value);
        const active = document.getElementById("avail-active").checked;

        try {
            const response = await fetch("/api/workers/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng, radius, hourlyRate: rate, isActive: active })
            });
            if (response.ok) {
                showToast(t("alertSuccessAvailability"), "success");
                loadMapData();
            }
        } catch {
            showToast(t("alertError"), "error");
        }
    });

    // Chat form
    document.getElementById("chat-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("chat-input");
        const text = input.value.trim();
        if (!text || !activeChatJobId || !activeChatPartnerId) return;

        try {
            const response = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toUserId: activeChatPartnerId, jobId: activeChatJobId, content: text })
            });
            if (response.ok) {
                input.value = "";
                loadChatMessages(activeChatJobId);
            }
        } catch (error) {
            console.error("Send message error:", error);
        }
    });

    // Logout button
    document.querySelectorAll(".btn-logout").forEach(btn => {
        btn.addEventListener("click", () => {
            Auth.logout().then(() => {
                showView("landing");
                if (currentChatInterval) clearInterval(currentChatInterval);
            });
        });
    });
}

function showView(viewName) {
    if (viewName === "landing") {
        document.getElementById("landing-view").classList.remove("hidden");
        document.getElementById("app-view").classList.add("hidden");
    } else if (viewName === "app") {
        document.getElementById("landing-view").classList.add("hidden");
        document.getElementById("app-view").classList.remove("hidden");
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 100);
    }
}

function toggleAuthForm(showRegister) {
    if (showRegister) {
        document.getElementById("auth-login-box").classList.add("hidden");
        document.getElementById("auth-register-box").classList.remove("hidden");
    } else {
        document.getElementById("auth-login-box").classList.remove("hidden");
        document.getElementById("auth-register-box").classList.add("hidden");
    }
}

function selectRole(role) {
    document.querySelectorAll(".role-option").forEach(opt => {
        if (opt.getAttribute("data-role") === role) {
            opt.classList.add("selected");
        } else {
            opt.classList.remove("selected");
        }
    });
}

function updateUIForUser(user) {
    if (!user) return;

    // Set profile avatars and names
    document.querySelectorAll(".profile-avatar-img").forEach(img => img.src = user.avatar);
    document.querySelectorAll(".profile-user-name").forEach(el => el.innerText = user.name);
    document.querySelectorAll(".profile-user-rating").forEach(el => el.innerText = user.rating.toFixed(1));
    document.querySelectorAll(".profile-user-role").forEach(el => el.innerText = user.role === "worker" ? t("roleWorker") : t("roleEmployer"));

    // Config forms
    document.getElementById("profile-name-input").value = user.name;
    document.getElementById("profile-bio-input").value = user.bio || "";

    // Show/hide options depending on roles
    const btnPost = document.getElementById("btn-post-job-trigger");
    const tabWorkers = document.getElementById("tab-workers");
    const btnAvail = document.getElementById("btn-avail-trigger");

    if (user.role === "employer") {
        if (btnPost) btnPost.classList.remove("hidden");
        if (tabWorkers) tabWorkers.classList.remove("hidden");
        if (btnAvail) btnAvail.classList.add("hidden");
        switchTab("feed");
    } else {
        if (btnPost) btnPost.classList.add("hidden");
        if (tabWorkers) tabWorkers.classList.add("hidden");
        if (btnAvail) btnAvail.classList.remove("hidden");
        switchTab("feed");
    }

    // Set initial map position to user location if available
    if (user.location_lat && user.location_lng) {
        map.setView([user.location_lat, user.location_lng], 13);
    }
}

// Tab navigation within Sidebar
function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tab) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Hide all panel views inside sidebar
    document.getElementById("panel-feed").classList.add("hidden");
    document.getElementById("panel-my-jobs").classList.add("hidden");
    document.getElementById("panel-profile").classList.add("hidden");
    document.getElementById("panel-messages").classList.add("hidden");

    if (currentChatInterval) {
        clearInterval(currentChatInterval);
    }

    if (tab === "feed") {
        document.getElementById("panel-feed").classList.remove("hidden");
        loadJobsFeed();
    } else if (tab === "my-jobs") {
        document.getElementById("panel-my-jobs").classList.remove("hidden");
        loadMyJobs();
    } else if (tab === "profile") {
        document.getElementById("panel-profile").classList.remove("hidden");
        loadProfileReviews();
    } else if (tab === "messages") {
        document.getElementById("panel-messages").classList.remove("hidden");
        loadChatOverview();
    }
}

// Load jobs to display on both feed list and map pins
async function loadJobsFeed(search = "") {
    try {
        const response = await fetch("/api/jobs");
        if (!response.ok) return;

        const jobs = await response.json();
        const feedList = document.getElementById("jobs-feed-list");
        feedList.innerHTML = "";

        // Clear existing map pins
        jobsLayer.clearLayers();

        if (jobs.length === 0) {
            feedList.innerHTML = `<div class="txt-center" style="padding:2rem;" data-i18n="txtNoJobs">${t("txtNoJobs")}</div>`;
            return;
        }

        const query = search.toLowerCase();

        jobs.forEach(job => {
            // Apply text filter if any
            if (query && !job.title.toLowerCase().includes(query) && !job.description.toLowerCase().includes(query)) {
                return;
            }

            // Create list element
            const card = document.createElement("div");
            card.className = "job-card";
            card.innerHTML = `
                <div class="job-card-header">
                    <span class="job-title">${job.title}</span>
                    <span class="job-pay">${job.pay}€ <small style="font-size:0.7rem;color:var(--text-muted)">${job.payType === 'hourly' ? t('lblHourly') : t('lblFixed')}</small></span>
                </div>
                <div class="job-category-badge">${job.category}</div>
                <p class="job-desc">${job.description}</p>
                <div class="job-footer">
                    <span class="job-footer-item"><i class="ri-map-pin-line"></i> ${job.address.split(",")[0]}</span>
                    <span class="job-footer-item"><i class="ri-time-line"></i> ${job.duration || ''}</span>
                </div>
            `;

            card.addEventListener("click", () => {
                showJobDetails(job);
            });

            feedList.appendChild(card);

            // Add Pin to map
            const orangeIcon = L.divIcon({
                html: '<div class="marker-pin-wrapper"><div class="marker-pin-icon" style="background:#ff6b00"></div></div>',
                iconSize: [30, 42],
                iconAnchor: [15, 42]
            });

            const marker = L.marker([job.lat, job.lng], { icon: orangeIcon }).addTo(jobsLayer);
            
            // Map pin click opens detail panel
            marker.on("click", () => {
                showJobDetails(job);
                map.panTo([job.lat, job.lng]);
            });
        });
    } catch (error) {
        console.error("Load jobs feed failed:", error);
    }
}

// Load active workers nearby to show on map (Employer view)
async function loadMapData() {
    if (!Auth.user) return;

    try {
        // Load workers
        if (Auth.user.role === "employer") {
            const res = await fetch("/api/workers");
            if (res.ok) {
                const workers = await res.json();
                workersLayer.clearLayers();

                workers.forEach(w => {
                    const workerIcon = L.divIcon({
                        html: `<div class="marker-pin-wrapper"><div class="marker-pin-worker"><img src="${w.avatar}" /></div></div>`,
                        iconSize: [36, 36],
                        iconAnchor: [18, 18]
                    });

                    const marker = L.marker([w.lat, w.lng], { icon: workerIcon }).addTo(workersLayer);
                    
                    marker.bindPopup(`
                        <div style="color:var(--text-primary);padding:4px;text-align:center;">
                            <h4 style="margin-bottom:4px;">${w.name}</h4>
                            <div style="color:#ffaa00;font-size:0.8rem;margin-bottom:6px;">★ ${w.rating.toFixed(1)}</div>
                            <div style="font-weight:700;color:#ff6b00;margin-bottom:8px;">${w.hourlyRate}€ / hora</div>
                            <button class="btn-primary" style="padding:6px 12px;font-size:0.75rem;" onclick="openWorkerContact(${w.workerId}, '${w.name}')">${t("btnMessages")}</button>
                        </div>
                    `);
                });
            }
        }
    } catch (e) {
        console.error("Load map data error:", e);
    }
}

// Show job details panel in sidebar
function showJobDetails(job) {
    document.getElementById("panel-feed").classList.add("hidden");
    const detailPanel = document.getElementById("panel-job-detail");
    detailPanel.classList.remove("hidden");

    document.getElementById("detail-title").innerText = job.title;
    document.getElementById("detail-category").innerText = job.category;
    document.getElementById("detail-desc").innerText = job.description;
    document.getElementById("detail-pay").innerText = `${job.pay}€`;
    document.getElementById("detail-pay-type").innerText = job.payType === "hourly" ? t("lblHourly") : t("lblFixed");
    document.getElementById("detail-duration").innerText = job.duration || "-";
    document.getElementById("detail-address").innerText = job.address;

    document.getElementById("detail-employer-avatar").src = job.employerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${job.employerId}`;
    document.getElementById("detail-employer-name").innerText = job.employerName || "FlexJob Employer";
    document.getElementById("detail-employer-rating").innerText = (job.employerRating || 5.0).toFixed(1);

    // Context button: Apply (Worker) or Applications panel (Employer)
    const actionContainer = document.getElementById("job-action-container");
    actionContainer.innerHTML = "";

    if (Auth.user.role === "worker") {
        if (job.status === "open") {
            const btnApply = document.createElement("button");
            btnApply.className = "btn-primary";
            btnApply.style.width = "100%";
            btnApply.innerText = t("btnApply");
            btnApply.onclick = async () => {
                try {
                    const response = await fetch("/api/jobs/apply", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ jobId: job.id })
                    });
                    if (response.ok) {
                        showToast(t("alertSuccessApply"), "success");
                        btnApply.disabled = true;
                        btnApply.innerText = t("btnApplied");
                        btnApply.className = "btn-outline";
                    }
                } catch {
                    showToast(t("alertError"), "error");
                }
            };
            actionContainer.appendChild(btnApply);
        } else if (job.workerId === Auth.user.id) {
            const btnChat = document.createElement("button");
            btnChat.className = "btn-primary";
            btnChat.style.width = "100%";
            btnChat.innerText = t("btnMessages");
            btnChat.onclick = () => {
                openChat(job.id, job.employerId, job.employerName);
            };
            actionContainer.appendChild(btnChat);
        }
    } else {
        // Employer view of their own job detail
        if (job.employerId === Auth.user.id) {
            if (job.status === "open") {
                // Show list of applicants
                const appsDiv = document.createElement("div");
                appsDiv.innerHTML = `<h3 style="margin-top:1.5rem;" data-i18n="lblApplicants">${t("lblApplicants")}</h3><div class="applicants-list" id="applicants-list-container"></div>`;
                actionContainer.appendChild(appsDiv);
                loadApplicants(job.id);
            } else if (job.status === "accepted") {
                // Show chat and complete button
                const btnChat = document.createElement("button");
                btnChat.className = "btn-outline";
                btnChat.style.width = "100%";
                btnChat.style.marginBottom = "8px";
                btnChat.innerText = t("btnMessages");
                btnChat.onclick = () => {
                    openChat(job.id, job.workerId, job.workerName || "Worker");
                };

                const btnComp = document.createElement("button");
                btnComp.className = "btn-primary";
                btnComp.style.width = "100%";
                btnComp.innerText = t("btnComplete");
                btnComp.onclick = () => {
                    openRatingModal(job.id, job.workerName || "Trabalhador");
                };

                actionContainer.appendChild(btnChat);
                actionContainer.appendChild(btnComp);
            }
        }
    }
}

function hideJobDetails() {
    document.getElementById("panel-job-detail").classList.add("hidden");
    document.getElementById("panel-feed").classList.remove("hidden");
}

// Load applicants lists for Employers
async function loadApplicants(jobId) {
    try {
        const response = await fetch(`/api/jobs/applications?jobId=${jobId}`);
        if (!response.ok) return;

        const apps = await response.json();
        const container = document.getElementById("applicants-list-container");
        container.innerHTML = "";

        if (apps.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:8px;">Ainda sem candidaturas.</p>`;
            return;
        }

        apps.forEach(app => {
            const card = document.createElement("div");
            card.className = "applicant-card";
            card.innerHTML = `
                <div class="applicant-info">
                    <img class="user-avatar" src="${app.worker.avatar}" style="width:36px;height:36px;" />
                    <div class="applicant-details">
                        <h4>${app.worker.name}</h4>
                        <p>★ ${app.worker.rating.toFixed(1)} • ${app.worker.bio || ''}</p>
                    </div>
                </div>
                <div class="applicant-actions">
                    <button class="btn-small btn-small-success" onclick="respondApplicant(${app.id}, true, ${jobId})">${t("lblAccept")}</button>
                    <button class="btn-small btn-small-danger" onclick="respondApplicant(${app.id}, false, ${jobId})">${t("lblReject")}</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Load applicants error:", e);
    }
}

async function respondApplicant(appId, accept, jobId) {
    try {
        const response = await fetch("/api/jobs/applications/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId: appId, accept: accept })
        });
        if (response.ok) {
            showToast(accept ? "Candidatura aceite!" : "Candidatura recusada.", accept ? "success" : "info");
            // Reload job feed and return back
            loadJobsFeed();
            switchTab("my-jobs");
        }
    } catch {
        showToast(t("alertError"), "error");
    }
}

// Load Employer/Worker tasks logs
async function loadMyJobs() {
    try {
        const response = await fetch("/api/jobs/my");
        if (!response.ok) return;

        const jobs = await response.json();
        const container = document.getElementById("my-jobs-list");
        container.innerHTML = "";

        if (jobs.length === 0) {
            container.innerHTML = `<div class="txt-center" style="padding:2rem;color:var(--text-secondary)">Ainda não tens tarefas ativas.</div>`;
            return;
        }

        jobs.forEach(job => {
            let statusText = t("statusOpen");
            let badgeColor = "var(--brand-primary)";
            if (job.status === "accepted") {
                statusText = t("statusAccepted");
                badgeColor = "var(--success)";
            } else if (job.status === "completed") {
                statusText = t("statusCompleted");
                badgeColor = "var(--text-muted)";
            }

            const card = document.createElement("div");
            card.className = "job-card";
            card.innerHTML = `
                <div class="job-card-header">
                    <span class="job-title">${job.title}</span>
                    <span class="job-pay">${job.pay}€</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                    <span style="font-size:0.75rem;background:${badgeColor};color:white;padding:3px 8px;border-radius:4px;font-weight:700;">${statusText}</span>
                    <span style="font-size:0.8rem;color:var(--text-muted)">${job.createdAt.split("T")[0]}</span>
                </div>
                ${job.applicationsCount > 0 ? `<div style="font-size:0.8rem;color:var(--brand-primary);margin-top:8px;font-weight:700;">${job.applicationsCount} candidaturas pendentes</div>` : ''}
            `;

            card.onclick = () => {
                showJobDetails(job);
            };

            container.appendChild(card);
        });
    } catch (e) {
        console.error("Load my jobs error:", e);
    }
}

// Chat overview/inbox list
async function loadChatOverview() {
    try {
        const response = await fetch("/api/messages/inbox");
        if (!response.ok) return;
        const chats = await response.json();
        const container = document.getElementById("chat-inbox-list");
        container.innerHTML = "";

        if (chats.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);">${t("txtNoMessages")}</div>`;
            return;
        }

        chats.forEach(c => {
            const card = document.createElement("div");
            card.className = "applicant-card";
            card.style.cursor = "pointer";
            
            const lastMsgPreview = c.lastMessage ? (c.lastMessage.length > 30 ? c.lastMessage.substring(0, 30) + "..." : c.lastMessage) : "";
            const isDirect = c.jobId === 0;

            card.innerHTML = `
                <div class="applicant-info">
                    <img class="user-avatar" src="${c.partnerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${c.partnerId}`}" style="width:36px;height:36px;" />
                    <div class="applicant-details" style="flex:1;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;width:100%;">
                            <h4>${c.partnerName}</h4>
                            <span style="font-size:0.7rem;color:var(--text-muted);">${c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                        </div>
                        <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${lastMsgPreview}</p>
                        <span style="font-size:0.7rem;background:${isDirect ? 'var(--border-color)' : 'rgba(255,107,0,0.1)'};color:${isDirect ? 'var(--text-muted)' : 'var(--brand-primary)'};padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px;font-weight:600;">
                            ${isDirect ? t("lblDirectContact") : c.jobTitle}
                        </span>
                    </div>
                </div>
            `;
            card.onclick = () => {
                openChat(c.jobId, c.partnerId, c.partnerName);
            };
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Load chats error:", error);
    }
}

// Open chat window
function openChat(jobId, partnerId, partnerName) {
    activeChatJobId = jobId;
    activeChatPartnerId = partnerId;

    document.getElementById("panel-messages").classList.add("hidden");
    const activeChat = document.getElementById("panel-active-chat");
    activeChat.classList.remove("hidden");

    document.getElementById("chat-partner-name").innerText = partnerName;

    loadChatMessages(jobId);

    // Refresh chat messages every 3 seconds
    if (currentChatInterval) clearInterval(currentChatInterval);
    currentChatInterval = setInterval(() => loadChatMessages(jobId), 3000);
}

function closeChat() {
    if (currentChatInterval) clearInterval(currentChatInterval);
    document.getElementById("panel-active-chat").classList.add("hidden");
    document.getElementById("panel-messages").classList.remove("hidden");
    loadChatOverview();
}

async function loadChatMessages(jobId) {
    try {
        const response = await fetch(`/api/messages?jobId=${jobId}`);
        if (!response.ok) return;

        const msgs = await response.json();
        const container = document.getElementById("chat-messages-container");
        container.innerHTML = "";

        msgs.forEach(m => {
            const isOutgoing = m.fromUserId === Auth.user.id;
            const bubble = document.createElement("div");
            bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
            
            const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            bubble.innerHTML = `
                <div>${m.content}</div>
                <div class="message-time">${timeStr}</div>
            `;
            container.appendChild(bubble);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error("Load messages error:", error);
    }
}

function openWorkerContact(workerId, workerName) {
    // Open a system message setup or chat
    // Employers can message workers directly if they set themselves active.
    // Let's create/fetch a stub conversation.
    openChat(0, workerId, workerName); // jobId 0 represents generic user inquiry
}

function openRatingModal(jobId, workerName) {
    let modal = document.getElementById("rating-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "rating-modal";
        modal.className = "modal-overlay hidden";
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;text-align:center;">
                <h3 id="rating-modal-title" style="margin-bottom:1.5rem;font-weight:700;"></h3>
                <div style="font-size:2.5rem;color:var(--text-muted);display:flex;justify-content:center;gap:12px;margin-bottom:1.5rem;" id="rating-stars-container">
                    <span class="star-btn" data-star="1" style="cursor:pointer;transition:color 0.2s ease;">★</span>
                    <span class="star-btn" data-star="2" style="cursor:pointer;transition:color 0.2s ease;">★</span>
                    <span class="star-btn" data-star="3" style="cursor:pointer;transition:color 0.2s ease;">★</span>
                    <span class="star-btn" data-star="4" style="cursor:pointer;transition:color 0.2s ease;">★</span>
                    <span class="star-btn" data-star="5" style="cursor:pointer;transition:color 0.2s ease;">★</span>
                </div>
                <textarea id="rating-comment" style="background:var(--bg-main);border:1px solid var(--border-color);color:white;border-radius:8px;width:100%;height:90px;resize:none;margin-bottom:1.5rem;padding:12px;font-family:var(--font-sans);font-size:0.9rem;" placeholder="Comentário sobre o serviço (opcional)..."></textarea>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button class="btn-outline" style="flex:1;" onclick="closeRatingModal()">Cancelar</button>
                    <button class="btn-primary" style="flex:1;" id="rating-submit-btn">Concluir</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById("rating-modal-title").innerText = `${t("btnComplete")} - ${workerName}`;
    document.getElementById("rating-comment").value = "";

    let selectedStar = 5;
    const stars = modal.querySelectorAll(".star-btn");
    
    function highlightStars(count) {
        stars.forEach(s => {
            const val = parseInt(s.getAttribute("data-star"));
            if (val <= count) {
                s.style.color = "var(--brand-primary)";
            } else {
                s.style.color = "var(--text-muted)";
            }
        });
    }

    highlightStars(5);

    stars.forEach(s => {
        s.onclick = () => {
            selectedStar = parseInt(s.getAttribute("data-star"));
            highlightStars(selectedStar);
        };
    });

    const submitBtn = document.getElementById("rating-submit-btn");
    submitBtn.onclick = async () => {
        const comment = document.getElementById("rating-comment").value;
        try {
            const response = await fetch("/api/jobs/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId: jobId, rating: selectedStar, comment: comment })
            });

            if (response.ok) {
                showToast(t("statusCompleted"), "success");
                closeRatingModal();
                hideJobDetails();
                loadMyJobs();
                loadJobsFeed();
            } else {
                const err = await response.json();
                showToast(err.message || t("alertError"), "error");
            }
        } catch {
            showToast(t("alertError"), "error");
        }
    };

    modal.classList.remove("hidden");
}

function closeRatingModal() {
    const modal = document.getElementById("rating-modal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

async function loadProfileReviews() {
    try {
        const response = await fetch("/api/users/reviews");
        if (!response.ok) return;

        const reviews = await response.json();
        const container = document.getElementById("profile-reviews-list");
        container.innerHTML = "";

        if (reviews.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem;" data-i18n="txtNoReviews">${t("txtNoReviews") || "Ainda não tens avaliações."}</div>`;
            return;
        }

        reviews.forEach(r => {
            const card = document.createElement("div");
            card.style.background = "var(--bg-main)";
            card.style.border = "1px solid var(--border-color)";
            card.style.borderRadius = "8px";
            card.style.padding = "12px";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.gap = "4px";

            let stars = "";
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.round(r.rating)) {
                    stars += `<span style="color:#ffaa00;">★</span>`;
                } else {
                    stars += `<span style="color:var(--text-muted);">★</span>`;
                }
            }

            const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${r.reviewer_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.reviewer_name}`}" style="width:24px; height:24px; border-radius:50%; background:var(--bg-card);" />
                        <span style="font-weight:600; font-size:0.85rem;">${r.reviewer_name}</span>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
                </div>
                <div style="display:flex; gap:2px; font-size:0.9rem; margin-top:2px;">
                    ${stars}
                </div>
                ${r.comment ? `<p style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px; line-height:1.4;">${r.comment}</p>` : ""}
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Load profile reviews error:", e);
    }
}

// Post Job Modal management
function openPostJobModal() {
    document.getElementById("post-job-modal").classList.remove("hidden");
    document.getElementById("post-lat").value = "";
    document.getElementById("post-lng").value = "";
    document.getElementById("post-address").value = "";
    if (placementMarker) {
        map.removeLayer(placementMarker);
        placementMarker = null;
    }
    selectedCoordinates = null;
    showToast(t("txtSelectLocationOnMap"), "info");
}

function closePostJobModal() {
    document.getElementById("post-job-modal").classList.add("hidden");
    if (placementMarker) {
        map.removeLayer(placementMarker);
        placementMarker = null;
    }
}

function selectCategory(categoryValue, btnElement) {
    document.getElementById("post-category").value = categoryValue;
    document.querySelectorAll(".category-select-btn").forEach(btn => {
        btn.classList.remove("selected");
    });
    btnElement.classList.add("selected");
}

// Availability panel settings
function toggleAvailabilityPanel(show) {
    const panel = document.getElementById("availability-panel");
    if (show) {
        panel.classList.remove("hidden");
        // Center marker and circle on current user view
        const center = map.getCenter();
        updateAvailabilityLocationMarker(center.lat, center.lng);
        map.on("move", syncAvailabilityWithMapCenter);
    } else {
        panel.classList.add("hidden");
        map.off("move", syncAvailabilityWithMapCenter);
        if (availabilityPlacementMarker) {
            map.removeLayer(availabilityPlacementMarker);
            availabilityPlacementMarker = null;
        }
        if (availabilityRadiusCircle) {
            map.removeLayer(availabilityRadiusCircle);
            availabilityRadiusCircle = null;
        }
    }
}

function syncAvailabilityWithMapCenter() {
    if (availabilityPlacementMarker && !selectedCoordinates) {
        const center = map.getCenter();
        availabilityPlacementMarker.setLatLng(center);
        const radius = parseFloat(document.getElementById("avail-radius").value) || 2;
        updateAvailabilityCircle(center.lat, center.lng, radius);
    }
}

function onRadiusChange(newVal) {
    const r = parseFloat(newVal);
    if (availabilityPlacementMarker && availabilityRadiusCircle) {
        const pos = availabilityPlacementMarker.getLatLng();
        updateAvailabilityCircle(pos.lat, pos.lng, r);
    }
}

// Search bar keypress listener
function onSearchKeyPress(event) {
    if (event.key === "Enter") {
        const searchVal = event.target.value;
        loadJobsFeed(searchVal);
    }
}
