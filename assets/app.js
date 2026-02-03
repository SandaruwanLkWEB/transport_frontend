// Token management
function getToken() {
  return localStorage.getItem("token");
}

function setToken(t) {
  localStorage.setItem("token", t);
}

function clearToken() {
  localStorage.removeItem("token");
}

// DOM helpers
function qs(id) {
  return document.getElementById(id);
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

// Toast notifications
function ensureToast() {
  if (document.getElementById("toast")) return;
  const div = document.createElement("div");
  div.id = "toast";
  document.body.appendChild(div);
}

function toast(msg, type = "info") {   // type: "info", "success", "error", "warning"
  ensureToast();
  const t = qs("toast");
  t.textContent = msg;
  t.className = `toast ${type}`;     // Assumes you have CSS classes .toast.info, .toast.success, etc.
  t.style.display = "block";

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    t.style.display = "none";
    t.className = "toast";           // reset classes
  }, 2800);
}

// HTML escape helper
function escapeHTML(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// Core API fetch wrapper
const API_BASE = window.API_BASE_URL || "/api";  // fallback

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const base = API_BASE.replace(/\/$/, "");
  let res, text, data;

  try {
    res = await fetch(`\( {base} \){path}`, { ...options, headers });
    text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    // Network / CORS / timeout / etc.
    const msg_en = "Network / connection issue. Please try again.";
    const msg_si = "ජාල/සම්බන්ධතා ගැටලුවක්. කරුණාකර නැවත උත්සාහ කරන්න.";
    throw Object.assign(new Error(msg_en), {
      userMessage: `\( {msg_si} ( \){msg_en})`,
      isNetworkError: true,
      originalError: e
    });
  }

  // Handle 401 → force logout
  if (res.status === 401) {
    clearToken();
    location.href = "login.html";
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `Server error (${res.status})`
    );
  }

  return data;
}

async function loadMe() {
  return api("/me");
}

async function guardRole(role) {
  try {
    const resp = await loadMe();
    const user = resp?.me;
    if (!user || user.role !== role) {
      logout();
      return null;
    }
    return user;
  } catch (err) {
    // Already handled redirect in api() for 401
    console.warn("Guard role failed:", err);
    throw err;
  }
}

function logout() {
  clearToken();
  location.href = "login.html";
}

// ──────────────────────────────────────────────
// Route tree / lookups
// ──────────────────────────────────────────────

let ROUTE_TREE = null;

async function loadRouteTree(force = false) {
  if (!force && ROUTE_TREE) return ROUTE_TREE;

  // Try cache (6 hours)
  try {
    const cached = localStorage.getItem("routesTree");
    if (cached) {
      const obj = JSON.parse(cached);
      if (obj?.at && (Date.now() - obj.at) < 6 * 60 * 60 * 1000 && obj.data) {
        ROUTE_TREE = obj.data;
        return ROUTE_TREE;
      }
    }
  } catch {}

  const d = await api("/lookup/routes-tree");
  ROUTE_TREE = {
    routes: d.routes || [],
    sub_routes: d.sub_routes || []
  };

  localStorage.setItem("routesTree", JSON.stringify({
    at: Date.now(),
    data: ROUTE_TREE
  }));

  return ROUTE_TREE;
}

function subRoutesFor(route_id) {
  if (!ROUTE_TREE) return [];
  const id = Number(route_id);
  return ROUTE_TREE.sub_routes.filter(s => Number(s.route_id) === id);
}

// ──────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────

function optionHTML(
  list,
  valueKey,
  labelKey,
  selectedValue = null,
  includeEmpty = true,
  emptyLabel = "-- තෝරන්න --"
) {
  let html = includeEmpty ? `<option value="">${escapeHTML(emptyLabel)}</option>` : "";

  for (const item of list) {
    const value = String(item[valueKey] ?? "");
    const label = String(item[labelKey] ?? "");
    const selected = value === String(selectedValue) ? " selected" : "";
    html += `<option value="\( {escapeHTML(value)}" \){selected}>${escapeHTML(label)}</option>`;
  }

  return html;
}

function statusBadge(status) {
  const map = {
    "DRAFT":                ["කෙටුම්පත",               "warn"],
    "SUBMITTED":            ["යොමු කර ඇත",            "warn"],
    "ADMIN_APPROVED":       ["පරිපාලක අනුමත",         "good"],
    "TA_ASSIGNED_PENDING_HR":["HR ඔවරයිඩ් අනුමැතිය බලාපොරොත්තු", "warn"],
    "TA_ASSIGNED":          ["වාහන අනුයුක්ත කර ඇත",   "good"],
    "TA_FIX_REQUIRED":      ["TA විසින් සකස් කළ යුතුයි", "warn"],
    "HR_FINAL_APPROVED":    ["අවසාන අනුමත",          "good"],
    "REJECTED":             ["ප්‍රතික්ෂේප",           "bad"]
  };
  const [label, cls] = map[status] || [status, "badge"];
  return `<span class="badge \( {cls}"> \){label}</span>`;
}

function fmtDate(s) {
  if (!s) return "";
  if (typeof s !== "string") return String(s);
  if (s.includes("T")) return s.split("T")[0];
  if (s.includes(" ")) return s.split(" ")[0];
  return s;
}

function fmtTime(s) {
  if (!s) return "";
  if (typeof s !== "string") return String(s);

  // Already HH:MM or HH:MM:SS → take first 5 chars
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.slice(0, 5);
  }

  // ISO datetime
  if (s.includes("T")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `\( {String(d.getHours()).padStart(2, "0")}: \){String(d.getMinutes()).padStart(2, "0")}`;
    }
    // Fallback: take time part
    return (s.split("T")[1] || "").replace("Z", "").slice(0, 5);
  }

  // "YYYY-MM-DD HH:MM:SS"
  if (s.includes(" ")) {
    return (s.split(" ")[1] || "").slice(0, 5);
  }

  return s;
}

function routeLabel(r) {
  if (!r) return "";
  const no = (r.route_no || "").trim();
  const name = (r.route_name || "").trim();
  return no && name ? `${no} - ${name}` : (name || no || "");
}

// ──────────────────────────────────────────────
// Admin: HOD registration approvals
// ──────────────────────────────────────────────

async function loadPendingHodRegs() {
  return api("/admin/hod-registrations");
}

async function approveHodReg(id) {
  return api(`/admin/hod-registrations/${id}/approve`, { method: "POST" });
}

async function rejectHodReg(id) {
  return api(`/admin/hod-registrations/${id}/reject`, { method: "POST" });
}

// ──────────────────────────────────────────────
// Admin: Bulk sub-routes (grams)
// ──────────────────────────────────────────────

async function bulkUpsertSubs(routeId, lines) {
  return api(`/admin/routes/${routeId}/subroutes/bulk`, {
    method: "POST",
    body: JSON.stringify({ lines })
  });
}
