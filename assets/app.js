// --- STATE & AUTH ---
function setToken(token) { localStorage.setItem("token", token); }
function getToken() { return localStorage.getItem("token"); }
function clearToken() { localStorage.removeItem("token"); window.location.href = "login.html"; }

// --- API WRAPPER ---
async function api(path, options = {}) {
    const headers = options.headers || {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    headers["Content-Type"] = "application/json";

    try {
        const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {}; // Handle empty responses

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                // Token Expired or Invalid
                // clearToken(); // Optional: Auto logout
            }
            throw new Error(data.error || "Server Error");
        }
        return data;
    } catch (e) {
        showToast(e.message, "error");
        throw e;
    }
}

// --- UI HELPERS ---
function qs(selector) { return document.querySelector(selector); }
function qsa(selector) { return document.querySelectorAll(selector); }

function showToast(msg, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- LAYOUT & NAVIGATION (System එක professional කරන්නේ මේකෙන්) ---
function renderLayout(userRole) {
    const navItems = {
        "ADMIN": [
            { label: "Dashboard", link: "admin.html", icon: "🏠" },
            { label: "Departments", link: "#", onClick: "setTab('master')" }, // Example of calling tab function
        ],
        "HOD": [
            { label: "Dashboard", link: "hod.html", icon: "📊" },
        ],
        "TA": [
             { label: "Vehicles", link: "ta.html", icon: "🚐" },
        ],
        "HR": [
             { label: "Approvals", link: "hr.html", icon: "✅" },
        ],
        "EMP": [
             { label: "My Transport", link: "emp.html", icon: "📍" },
        ]
    };

    // Common items if needed
    const roleItems = navItems[userRole] || [];

    const sidebarHTML = `
        <div class="sidebar">
            <div class="brand">🚀 TransportSys</div>
            <nav>
                ${roleItems.map(item => `
                    <a href="${item.link}" class="nav-item" ${item.onClick ? `onclick="${item.onClick}"` : ''}>
                        ${item.icon || '•'} ${item.label}
                    </a>
                `).join('')}
                <a href="#" class="nav-item logout" onclick="logout()">🚪 පිටවන්න</a>
            </nav>
             <div style="margin-top:auto; padding-top:20px; font-size:0.8rem; color:#9ca3af;">
                Logged as: <b>${userRole}</b>
            </div>
        </div>
        <div class="main-content">
            <header class="flex-between" style="margin-bottom:20px;">
                <h2 id="page-title">Dashboard</h2>
                <div class="user-info">
                   </div>
            </header>
            <div id="app-content">
                </div>
        </div>
    `;

    // Note: Since we are using multi-page HTML files, we only inject the Sidebar into a placeholder
    // Or we stick to the HTML structure where Sidebar is defined.
    // BETTER APPROACH FOR YOU: Use the HTML structure below in every file.
}

function logout() {
    clearToken();
}

async function checkAuth(requiredRole) {
    const token = getToken();
    if (!token) { window.location.href = "login.html"; return null; }
    
    // Ideally we verify with /me, but for speed we can decode or rely on stored role
    // Let's call /me to be safe
    try {
        const d = await api("/me");
        if (requiredRole && d.me.role !== requiredRole) {
            window.location.href = "index.html"; // Redirect to role dispatcher
            return null;
        }
        return d.me;
    } catch (e) {
        clearToken();
        return null;
    }
}

// --- UTILS ---
function fmtDate(iso) { return iso ? iso.split("T")[0] : ""; }
function fmtTime(timeStr) { return timeStr ? timeStr.slice(0, 5) : ""; }
