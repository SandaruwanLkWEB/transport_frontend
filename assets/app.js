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

async function api(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, Object.assign({}, options, { headers }));
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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
    "ADMIN_APPROVED": ["පරිපාලක අනුමත","good"],
    "TA_ASSIGNED_PENDING_HR": ["HR ඔවරයිඩ් අනුමැතිය බලාපොරොත්තු","warn"],
    "TA_ASSIGNED": ["වාහන අනුයුක්ත කර ඇත","good"],
    "TA_FIX_REQUIRED": ["TA විසින් සකස් කළ යුතුයි","warn"],
    "HR_FINAL_APPROVED": ["අවසාන අනුමත","good"],
    "REJECTED": ["ප්‍රතික්ෂේප","bad"]
  };
  const v = map[status] || [status, "badge"];
  return `<span class="badge ${v[1]}">${v[0]}</span>`;
}

