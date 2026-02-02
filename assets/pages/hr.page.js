let ME=null;
let LIST=[];

function setTab(tab){
  const tabs = ["approve","reports"];
  for(const t of tabs){
    qs("pane_"+t).style.display = (t===tab) ? "" : "none";
    qs("tab"+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle("active", t===tab);
  }
}

async function guard(){
  ME = await guardRole("HR");
  if(!ME) return;
  qs("meBox").innerHTML = `<b>${ME.role}</b> | ${ME.email}`;
}

async function loadTARequests(){
  const d = await api("/hr/requests/ta-assigned");
  LIST = d.requests || [];
  render();
}

function render(){
  if(LIST.length===0){ qs("listBox").innerHTML = "<span class='badge good'>බලාපොරොත්තු වූ ඉල්ලීම් නැත</span>"; return; }
  let html = "<table><tr><th>ID</th><th>දිනය</th><th>වේලාව</th><th>දෙපාර්තමේන්තුව</th><th>තත්ත්වය</th><th>ක්‍රියාව</th></tr>";
  for(const r of LIST){
    html += `<tr>
      <td>${r.id}</td>
      <td>${r.request_date}</td>
      <td>${r.request_time}</td>
      <td>${r.department_name}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        ${r.status==="TA_ASSIGNED_PENDING_HR" ? `
        <button class="btn small" onclick="overApprove(${r.id})">ඔවරයිඩ් අනුමත කරන්න</button>
        <button class="btn small secondary" onclick="overReject(${r.id})">ඔවරයිඩ් ප්‍රතික්ෂේප කරන්න</button>
      ` : `
        <button class="btn small" onclick="finalApprove(${r.id})">අවසාන අනුමැතිය</button>
      `}
      </td>
    </tr>`;
  }
  html += "</table>";
  qs("listBox").innerHTML = html;
}


async function overApprove(id){
  try{
    await api(`/hr/requests/${id}/overbook/approve`, {method:"POST"});
    toast("ඔවරයිඩ් (+1/+2) අනුමත කරන ලදී. දැන් අවසාන අනුමැතිය ලබා දිය හැක.");
    await loadTARequests();
  }catch(e){ toast(e.message); }
}

async function overReject(id){
  try{
    await api(`/hr/requests/${id}/overbook/reject`, {method:"POST"});
    toast("ඔවරයිඩ් ප්‍රතික්ෂේප කරන ලදී. TA වෙත නැවත යවයි (වාහන අමතර දාන්න/සකස් කරන්න).");
    await loadTARequests();
  }catch(e){ toast(e.message); }
}


async function finalApprove(id){
  try{
    await api(`/hr/requests/${id}/final-approve`, {method:"POST"});
    toast("අවසාන අනුමැතිය ලබා දුන්නා. වාර්තා සූදානම්.");
await loadTARequests();
  }catch(e){ toast(e.message); }
}

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
    await loadTARequests();
  }catch(e){ toast(e.message); logout(); }
})();

function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${da}`;
}
(function(){
  const rep = qs('repDate');
  if(rep && !rep.value) rep.value = todayISO();
})();
