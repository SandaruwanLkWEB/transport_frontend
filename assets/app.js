function getToken() { return localStorage.getItem("token"); }
function setToken(t) { localStorage.setItem("token", t); }
function clearToken() { localStorage.removeItem("token"); }

function qs(id){ return document.getElementById(id); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

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

function getApiBase(){
  const base = (API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!base || base.includes("YOUR_TRANSPORT_BACKEND")) {
    throw new Error("API සම්බන්ධතාව සකස් කරලා නැහැ. කරුණාකර assets/config.js තුළ API_BASE_URL ඔබගේ Transport Railway backend URL එකට දාන්න.");
  }
  return base;
}

let __backendChecked = false;
async function ensureBackendIsTransport(){
  if (__backendChecked) return;
  __backendChecked = true;
  const base = getApiBase();
  try{
    const res = await fetch(`${base}/health`, { method:"GET" });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok || data.service !== "transport-request-api") {
      __backendChecked = false;
      throw new Error("API URL වැරදියි. මේ වෙබ් එක Transport system එකට අදාළ Railway backend එකට පමණයි connect වෙන්න ඕන. ( /health -> service: transport-request-api )");
    }
  }catch(e){
    __backendChecked = false;
    throw e;
  }
}

async function api(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  await ensureBackendIsTransport();
  const base = getApiBase();
  let res, text, data;
  try{
    res = await fetch(`${base}${path}`, Object.assign({}, options, { headers }));
    text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  }catch(e){
    // Network / CORS / DNS issues
    throw new Error("ජාල/සම්බන්ධතා ගැටලුවක්. කරුණාකර නැවත උත්සාහ කරන්න.");
  }

  // Logout ONLY on token invalid/expired
  if (res.status === 401){
    clearToken();
    location.href = "login.html";
    throw new Error("නැවත ඇතුල් වන්න.");
  }

  // 403 = token valid but no permission (do NOT clear token)
  if (res.status === 403){
    throw new Error(data.error || "මෙම ක්‍රියාව සඳහා අවසර නැහැ.");
  }

  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

async function loadMe() { return api("/me"); }

async function guardRole(role){
  try{
    const me = await loadMe();
    if(!me.me){ location.href="login.html"; return null; }
    // cache role for safe redirects
    try{ localStorage.setItem("meRole", me.me.role || ""); }catch(e){}
    if (me.me.role !== role) {
      // redirect to correct dashboard (no logout)
      const r = me.me.role;
      if(r==="ADMIN") location.href="admin.html";
      else if(r==="HOD") location.href="hod.html";
      else if(r==="TA") location.href="ta.html";
      else if(r==="HR") location.href="hr.html";
      else if(r==="EMP") location.href="emp.html";
      else location.href="login.html";
      return null;
    }
    return me.me;
  }catch(e){
    // Do not force logout on API misconfig/500/CORS
    toast(e.message || "දෝෂයක්");
    return null;
  }
}

function logout(){
  clearToken();
  location.href = "login.html";
}

// ---- Lookups (routes/subroutes) ----
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
  const v = map[status] || [status, "badge"];
  return `<span class="badge ${v[1]}">${v[0]}</span>`;
}



function fmtDate(s){ if(!s) return ''; if(typeof s==='string' && s.includes('T')) return s.split('T')[0]; return s; }
function fmtTime(s){ if(!s) return ''; if(typeof s==='string' && s.length>=5) return s.slice(0,5); return s; }
function routeLabel(r){ if(!r) return ''; const no=(r.route_no||'').trim(); const name=(r.route_name||'').trim(); return (no&&name)?(`${no} - ${name}`):(name||no||''); }


// ---- Admin: HOD registration approvals ----
async function loadPendingHodRegs(){
  return api("/admin/hod-registrations");
}
async function approveHodReg(id){
  return api(`/admin/hod-registrations/${id}/approve`, { method:"POST" });
}
async function rejectHodReg(id){
  return api(`/admin/hod-registrations/${id}/reject`, { method:"POST" });
}

// ---- Admin: Bulk sub-routes (grams) ----
async function bulkUpsertSubs(routeId, lines){
  return api(`/admin/routes/${routeId}/subroutes/bulk`, { method:"POST", body: JSON.stringify({ lines }) });
}
