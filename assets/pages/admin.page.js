let ME=null;
let REQS=[];
let CURRENT=null;
let DEPS=[];
let ROUTES=[];
let SUBS=[];

function setTab(tab){
  const tabs = ["approvals","master","reports"];
  for(const t of tabs){
    qs("pane_"+t).style.display = (t===tab) ? "" : "none";
    qs("tab"+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle("active", t===tab);
  }
}

async function guard(){
  ME = await guardRole("ADMIN");
  if(!ME) return;
  qs("meBox").innerHTML = `<b>${ME.role}</b> | ${ME.email}`;
}

async function loadRequests(){
  const d = await api("/admin/requests");
  REQS = d.requests || [];
  renderRequests();
}

function renderRequests(){
  const status = qs("reqStatus").value;
  const q = (qs("reqSearch").value||"").toLowerCase();
  const list = REQS
    .filter(r => !status || r.status===status)
    .filter(r => (String(r.id).includes(q) || (r.department_name||"").toLowerCase().includes(q) || (r.request_date||"").toLowerCase().includes(q)));

  if(list.length===0){ qs("reqList").innerHTML = "<span class='badge warn'>No matching requests</span>"; return; }

  let html = "<table><tr><th>ID</th><th>Date</th><th>Time</th><th>Department</th><th>Status</th><th>Action</th></tr>";
  for(const r of list){
    const canApprove = r.status==="SUBMITTED";
    html += `<tr>
      <td>${r.id}</td>
      <td>${r.request_date}</td>
      <td>${r.request_time}</td>
      <td>${r.department_name}</td>
      <td>${statusBadge(r.status)}</td>
      <td><button class="btn small" onclick="openDetail(${r.id})">View</button></td>
    </tr>`;
  }
  html += "</table>";
  qs("reqList").innerHTML = html;
}

async function openDetail(id){
  try{
    const d = await api(`/admin/requests/${id}`);
    CURRENT = d.request;
    qs("reqDetail").style.display = "";
    qs("dReqId").textContent = id;
    qs("dMeta").innerHTML = `Dept: <b>${d.request.department_name}</b> | Date: <b>${d.request.request_date}</b> | Time: <b>${d.request.request_time}</b> | Status: ${statusBadge(d.request.status)}`;

    let html = "<table><tr><th>Employee</th><th>Emp No</th><th>Route</th><th>Sub</th></tr>";
    for(const e of d.employees){
      html += `<tr>
        <td>${e.full_name}</td>
        <td>${e.emp_no}</td>
        <td>${e.effective_route_id ?? ""}</td>
        <td>${e.effective_sub_route_id ?? ""}</td>
      </tr>`;
    }
    html += "</table>";
    qs("dEmployees").innerHTML = html;

    qs("btnApprove").disabled = d.request.status !== "SUBMITTED";
    if(d.request.status !== "SUBMITTED"){
      qs("btnApprove").textContent = "Approve (ADMIN)";
    }else{
      qs("btnApprove").textContent = "Approve (ADMIN)";
    }
  }catch(e){ toast(e.message); }
}

function closeDetail(){
  qs("reqDetail").style.display = "none";
  CURRENT=null;
}

async function approveReq(){
  try{
    if(!CURRENT) return;
    await api(`/admin/requests/${CURRENT.id}/approve`, {method:"POST"});
    toast("Approved");
    await loadRequests();
    await openDetail(CURRENT.id);
  }catch(e){ toast(e.message); }
}

// Master data
async function loadDepartments(){
  const d = await api("/admin/departments");
  DEPS = d.departments || [];
  let html = "<table><tr><th>Name</th><th>Action</th></tr>";
  for(const dep of DEPS){
    html += `<tr>
      <td><input id="dep_${dep.id}" value="${(dep.name||"").replace(/"/g,'&quot;')}" /></td>
      <td style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn small" onclick="updateDepartment(${dep.id})">Save</button>
        <button class="btn small ghost" onclick="deleteDepartment(${dep.id})">Delete</button>
      </td>
    </tr>`;
  }
  html += "</table>";
  qs("depList").innerHTML = html;

  // refresh dropdown for subroutes too
  // (departments used in register via /public/departments)
}

async function createDepartment(){
  try{
    const name = qs("depName").value.trim();
    if(!name) throw new Error("Name required");
    await api("/admin/departments", {method:"POST", body: JSON.stringify({name})});
    qs("depName").value="";
    toast("Department added");
    await loadDepartments();
  }catch(e){ toast(e.message); }
}

async function updateDepartment(id){
  try{
    const name = qs("dep_"+id).value.trim();
    await api(`/admin/departments/${id}`, {method:"PATCH", body: JSON.stringify({name})});
    toast("Saved");
    await loadDepartments();
  }catch(e){ toast(e.message); }
}
async function deleteDepartment(id){
  try{
    await api(`/admin/departments/${id}`, {method:"DELETE"});
    toast("Deleted");
    await loadDepartments();
  }catch(e){ toast(e.message); }
}

async function loadRoutes(){
  const d = await api("/admin/routes");
  ROUTES = d.routes || [];
  let html = "<table><tr><th>No</th><th>Name</th><th>Action</th></tr>";
  for(const r of ROUTES){
    html += `<tr>
      <td><input id="rno_${r.id}" value="${(r.route_no||"").replace(/"/g,'&quot;')}" /></td>
      <td><input id="rname_${r.id}" value="${(r.route_name||"").replace(/"/g,'&quot;')}" /></td>
      <td style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn small" onclick="updateRoute(${r.id})">Save</button>
        <button class="btn small ghost" onclick="deleteRoute(${r.id})">Delete</button>
      </td>
    </tr>`;
  }
  html += "</table>";
  qs("routeList").innerHTML = html;

  // dropdown for subroutes
  let opt = '<option value="">-- Select Route --</option>';
  for(const r of ROUTES){
    opt += `<option value="${r.id}">${r.route_no} - ${r.route_name}</option>`;
  }
  qs("subRouteParent").innerHTML = opt;
  // update lookup cache for other roles (optional): clear local cache
  localStorage.removeItem("routesTree");
}

async function createRoute(){
  try{
    const route_no = qs("routeNo").value.trim();
    const route_name = qs("routeName").value.trim();
    if(!route_no || !route_name) throw new Error("Route no & name required");
    await api("/admin/routes", {method:"POST", body: JSON.stringify({route_no, route_name})});
    qs("routeNo").value=""; qs("routeName").value="";
    toast("Route added");
    await loadRoutes();
  }catch(e){ toast(e.message); }
}

async function updateRoute(id){
  try{
    const route_no = qs("rno_"+id).value.trim();
    const route_name = qs("rname_"+id).value.trim();
    await api(`/admin/routes/${id}`, {method:"PATCH", body: JSON.stringify({route_no, route_name})});
    toast("Saved");
    await loadRoutes();
  }catch(e){ toast(e.message); }
}
async function deleteRoute(id){
  try{
    await api(`/admin/routes/${id}`, {method:"DELETE"});
    toast("Deleted");
    await loadRoutes();
    await loadSubRoutes();
  }catch(e){ toast(e.message); }
}

async function loadSubRoutes(){
  try{
    const routeId = qs("subRouteParent").value;
    if(!routeId){ qs("subList").innerHTML = "<span class='badge warn'>Select route</span>"; return; }
    const d = await api(`/admin/routes/${routeId}/subroutes`);
    SUBS = d.sub_routes || [];
    let html = "<table><tr><th>Sub Name</th><th>Action</th></tr>";
    for(const s of SUBS){
      html += `<tr>
        <td><input id="sname_${s.id}" value="${(s.sub_name||"").replace(/"/g,'&quot;')}" /></td>
        <td style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn small" onclick="updateSub(${s.id})">Save</button>
          <button class="btn small ghost" onclick="deleteSub(${s.id})">Delete</button>
        </td>
      </tr>`;
    }
    html += "</table>";
    qs("subList").innerHTML = html;
    localStorage.removeItem("routesTree");
  }catch(e){ toast(e.message); }
}

async function createSubRoute(){
  try{
    const routeId = qs("subRouteParent").value;
    const sub_name = qs("subName").value.trim();
    if(!routeId) throw new Error("Select route");
    if(!sub_name) throw new Error("Sub name required");
    await api(`/admin/routes/${routeId}/subroutes`, {method:"POST", body: JSON.stringify({sub_name})});
    qs("subName").value="";
    toast("Sub route added");
    await loadSubRoutes();
  }catch(e){ toast(e.message); }
}

async function updateSub(id){
  try{
    const sub_name = qs("sname_"+id).value.trim();
    await api(`/admin/subroutes/${id}`, {method:"PATCH", body: JSON.stringify({sub_name})});
    toast("Saved");
    await loadSubRoutes();
  }catch(e){ toast(e.message); }
}
async function deleteSub(id){
  try{
    await api(`/admin/subroutes/${id}`, {method:"DELETE"});
    toast("Deleted");
    await loadSubRoutes();
  }catch(e){ toast(e.message); }
}

// Reports
function downloadRouteReport(){
  const d = qs("repDate").value;
  if(!d){ toast("දිනය තෝරන්න"); return; }
  window.open(`${API_BASE_URL}/reports/daily/route-wise?date=${encodeURIComponent(d)}`, "_blank");
}
function downloadVehicleReport(){
  const d = qs("repDate").value;
  if(!d){ toast("දිනය තෝරන්න"); return; }
  window.open(`${API_BASE_URL}/reports/daily/vehicle?date=${encodeURIComponent(d)}`, "_blank");
}
(async function init(){
  try{
    await guard();
    await loadRequests();
    await loadDepartments();
    await loadRoutes();
    await loadSubRoutes();
  }catch(e){ toast(e.message); }
})();


async function renderHodRegs(){
  const tbody = document.getElementById('hodRegRows');
  if(!tbody) return;
  try{
    const deps = await api('/admin/departments');
    const d = await loadPendingHodRegs();
    const list = d.pending_hod || [];
    const depName = (id)=> (deps.departments||[]).find(x=>x.id===id)?.name || id || '';
    if(list.length===0){ tbody.innerHTML = `<tr><td colspan='4' class='mini'>No pending</td></tr>`; return; }
    tbody.innerHTML = list.map(u=>`<tr>
      <td>${u.email}</td><td>${depName(u.department_id)}</td><td>${fmtDate(u.created_at||'')}</td>
      <td><button class='btn' onclick='approveH(${u.id})'>Approve</button> <button class='btn' onclick='rejectH(${u.id})'>Reject</button></td>
    </tr>`).join('');
  }catch(e){ tbody.innerHTML = `<tr><td colspan='4'>${e.message}</td></tr>`; }
}
async function approveH(id){ await approveHodReg(id); await renderHodRegs(); toast('අනුමත කළා'); }
async function rejectH(id){ await rejectHodReg(id); await renderHodRegs(); toast('ප්‍රතික්ෂේප කළා'); }

async function doBulkSubs(){
  const routeId = document.getElementById('routeId')?.value || document.getElementById('selRoute')?.value;
  const lines = document.getElementById('bulkLines')?.value || '';
  if(!routeId){ toast('Route තෝරන්න'); return; }
  if(!lines.trim()){ toast('ග්‍රාම නාම දාන්න'); return; }
  try{
    const r = await bulkUpsertSubs(routeId, lines);
    toast(`Bulk OK: ${r.inserted||0}`);
    document.getElementById('bulkLines').value='';
    // refresh subroutes list if function exists
    if(typeof loadSubroutes==='function') loadSubroutes();
  }catch(e){ toast(e.message); }
}

// Call HOD regs render after main load
setTimeout(()=>{ try{ renderHodRegs(); }catch(e){} }, 400);


// Daily Run (Admin Lock)
function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${da}`;
}
function setDefaultRunDate(){
  const el = qs('runDate');
  if(el && !el.value) el.value = todayISO();
  const rep = qs('repDate');
  if(rep && !rep.value) rep.value = todayISO();
}
async function loadRunSummary(){
  try{
    const date = qs('runDate').value || todayISO();
    const data = await api(`/admin/run/${date}/summary`);
    const meta = qs('runMeta');
    const master = data.master_request ? `Master Request: #${data.master_request.id} (${data.master_request.status})` : 'Master Request: නැත (OPEN)';
    meta.innerHTML = `<span class="badge brand">${date}</span> <span class="badge">${master}</span> <span class="badge ok">Submitted: ${data.submitted_departments}</span> <span class="badge bad">Missing: ${data.missing_departments.length}</span>`;
    const tbody = qs('runDeptRows');
    tbody.innerHTML = data.departments.map(r => `
      <tr>
        <td>${r.department_name}</td>
        <td>${r.submitted ? '<span class="badge ok">ඔව්</span>' : '<span class="badge bad">නෑ</span>'}</td>
        <td>${r.requests_count}</td>
        <td>${r.employees_count}</td>
      </tr>
    `).join('');
    qs('runMissing').innerHTML = data.missing_departments.length ? `<ul style="margin:0; padding-left:18px;">${data.missing_departments.map(n=>`<li>${n}</li>`).join('')}</ul>` : 'සියල්ලම ලැබී ඇත ✅';
  }catch(e){
    toast(e.message);
  }
}
async function lockRun(){
  try{
    const date = qs('runDate').value || todayISO();
    const data = await api(`/admin/run/${date}/lock`, { method:'POST' });
    toast(`Lock කළා. Master Request #${data.master_request_id} (Employees: ${data.employees_added})`);
    await loadRunSummary();
  }catch(e){
    toast(e.message);
  }
}
setDefaultRunDate();
loadRunSummary();
