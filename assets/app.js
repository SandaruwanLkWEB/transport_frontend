// Shared helpers for all static pages (Vanilla JS)

function getToken() { return localStorage.getItem("token"); }
function setToken(t) { localStorage.setItem("token", t); }
function clearToken() { localStorage.removeItem("token"); }

function qs(id){ return document.getElementById(id); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

// ------------------------
// API base URL handling
// ------------------------
// Priority:
// 1) ?api=https://... (stored to localStorage)
// 2) localStorage.apiBase
// 3) API_BASE_URL from assets/config.js

function apiBase(){
  try{
    const url = new URL(location.href);
    const q = url.searchParams.get("api");
    const reset = url.searchParams.get("resetApi");
    if(reset === "1") localStorage.removeItem("apiBase");
    if(q){
      const cleaned = String(q).trim().replace(/\/$/, "");
      if(/^https?:\/\//i.test(cleaned)) localStorage.setItem("apiBase", cleaned);
    }
  }catch(e){ /* ignore */ }

  const stored = (localStorage.getItem("apiBase") || "").trim().replace(/\/$/, "");
  if(stored) return stored;
  const cfg = (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "");
  return String(cfg || "").trim().replace(/\/$/, "");
}

function ensureToast(){
  if (document.getElementById("toast")) return;
  const div = document.createElement("div");
  div.id = "toast";
  document.body.appendChild(div);
}

function toast(msg){
  ensureToast();
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ t.style.display="none"; }, 2600);
}

async function api(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const base = apiBase();
  if(!base){
    throw new Error("Backend URL එක (API_BASE_URL) සකස් කරලා නැහැ. assets/config.js තුළ Railway URL එක දාන්න.");
  }

  let res, text, data;
  try{
    res = await fetch(`${base}${path}`, Object.assign({}, options, { headers }));
    text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  }catch(e){
    // Network / CORS / DNS issues
    throw new Error("ජාල/සම්බන්ධතා ගැටලුවක්. (CORS/DNS/Network) කරුණාකර URL එකත් internet එකත් පරීක්ෂා කර නැවත උත්සාහ කරන්න.");
  }

  // Only logout on real auth errors
  if (res.status === 401){
    clearToken();
    location.href = "login.html";
    throw new Error("නැවත ඇතුල් වන්න.");
  }

  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

async function loadMe() { return api("/me"); }

async function guardRole(role){
  const me = await loadMe();
  if(!me.me || me.me.role !== role){ location.href="login.html"; return null; }
  return me.me;
}

function logout(){
  clearToken();
  location.href = "login.html";
}

// ------------------------
// Lookups (routes/subroutes)
// ------------------------
let ROUTE_TREE = null;
async function loadRouteTree(){
  if(ROUTE_TREE) return ROUTE_TREE;
  try{
    const cached = localStorage.getItem("routesTree");
    if(cached){
      const obj = JSON.parse(cached);
      // cache up to 6 hours
      if(obj && obj.at && (Date.now() - obj.at) < (6*60*60*1000) && obj.data){
        ROUTE_TREE = obj.data;
        return ROUTE_TREE;
      }
    }
  }catch(e){}

  const d = await api("/lookup/routes-tree");
  ROUTE_TREE = { routes: d.routes || [], sub_routes: d.sub_routes || [] };
  localStorage.setItem("routesTree", JSON.stringify({ at: Date.now(), data: ROUTE_TREE }));
  return ROUTE_TREE;
}

function subRoutesFor(route_id){
  if(!ROUTE_TREE) return [];
  return ROUTE_TREE.sub_routes.filter(s => String(s.route_id) === String(route_id));
}

function optionHTML(list, valueKey, labelKey, selectedValue, includeEmpty=true, emptyLabel="-- තෝරන්න --"){
  let html = includeEmpty ? `<option value="">${emptyLabel}</option>` : "";
  for(const x of list){
    const v = x[valueKey];
    const label = x[labelKey];
    const sel = String(v) === String(selectedValue) ? "selected" : "";
    html += `<option value="${v}" ${sel}>${label}</option>`;
  }
  return html;
}

// ------------------------
// UI helpers
// ------------------------
function statusBadge(status){
  const map = {
    "DRAFT": ["කෙටුම්පත","warn"],
    "SUBMITTED": ["යොමු කර ඇත","warn"],
    "ADMIN_APPROVED": ["පරිපාලක අනුමත","ok"],
    "TA_ASSIGNED_PENDING_HR": ["HR ඔවරයිඩ් අනුමැතිය බලාපොරොත්තු","warn"],
    "TA_ASSIGNED": ["වාහන අනුයුක්ත කර ඇත","ok"],
    "TA_FIX_REQUIRED": ["TA විසින් සකස් කළ යුතුයි","warn"],
    "HR_FINAL_APPROVED": ["අවසාන අනුමත","ok"],
    "REJECTED": ["ප්‍රතික්ෂේප","bad"]
  };
  const v = map[status] || [String(status||""), "badge"]; // fallback
  return `<span class="badge ${v[1]}">${v[0]}</span>`;
}

function fmtDate(s){
  if(!s) return "";
  if(typeof s === "string"){
    if(s.includes("T")) return s.split("T")[0];
    if(s.includes(" ")) return s.split(" ")[0];
    return s;
  }
  return String(s);
}

function fmtTime(s){
  if(!s) return "";
  if(typeof s === "string"){
    // "HH:MM" or "HH:MM:SS" -> "HH:MM"
    if(/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0,5);

    // ISO datetime string (best effort)
    if(s.includes("T")){
      // Prefer extracting time portion (avoids timezone shifts)
      const t = (s.split("T")[1] || "").replace("Z", "");
      if(/^\d{2}:\d{2}/.test(t)) return t.slice(0,5);

      const d = new Date(s);
      if(!isNaN(d)){
        const hh = String(d.getHours()).padStart(2,"0");
        const mm = String(d.getMinutes()).padStart(2,"0");
        return `${hh}:${mm}`;
      }
      return t.slice(0,5);
    }

    // "YYYY-MM-DD HH:MM:SS" -> "HH:MM"
    if(s.includes(" ")){
      const t = s.split(" ")[1] || "";
      if(/^\d{2}:\d{2}/.test(t)) return t.slice(0,5);
    }

    // fallback
    return s.length >= 5 ? s.slice(0,5) : s;
  }
  return String(s);
}

function routeLabel(r){
  if(!r) return "";
  const no = (r.route_no||"").toString().trim();
  const name = (r.route_name||"").toString().trim();
  return (no && name) ? `${no} - ${name}` : (name || no || "");
}

// ------------------------
// Admin: HOD registration approvals (optional helpers)
// ------------------------
async function loadPendingHodRegs(){ return api("/admin/hod-registrations"); }
async function approveHodReg(id){ return api(`/admin/hod-registrations/${id}/approve`, { method:"POST" }); }
async function rejectHodReg(id){ return api(`/admin/hod-registrations/${id}/reject`, { method:"POST" }); }

// Admin: Bulk sub-routes
async function bulkUpsertSubs(routeId, lines){
  return api(`/admin/routes/${routeId}/subroutes/bulk`, { method:"POST", body: JSON.stringify({ lines }) });
}
