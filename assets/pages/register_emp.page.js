(async ()=>{
  try{
    const d = await api("/public/departments");
    const sel = document.getElementById("department_id");
    sel.innerHTML = '<option value="">තෝරන්න</option>' + (d.departments||[]).map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
  }catch(e){}
})();
document.getElementById("btnReg").onclick = async ()=>{
  const payload = {
    emp_name: document.getElementById("emp_name").value.trim(),
    emp_no: document.getElementById("emp_no").value.trim(),
    email: document.getElementById("email").value.trim(),
    department_id: document.getElementById("department_id").value,
    password: document.getElementById("password").value
  };
  const msg = document.getElementById("msg");
  msg.className = "alert hidden";
  try{
    await api("/auth/register", { method:"POST", body: JSON.stringify(payload) });
    msg.textContent = "සාර්ථකයි. ඔබගේ ගිණුම HOD අනුමැතිය සඳහා යොමු කර ඇත.";
    msg.classList.remove("hidden"); msg.classList.add("ok");
  }catch(e){
    msg.textContent = e.message || "අසමත් විය";
    msg.classList.remove("hidden"); msg.classList.add("error");
  }
};
