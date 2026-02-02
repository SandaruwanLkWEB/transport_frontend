document.getElementById("btnLogin").onclick = async ()=>{
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");
  msg.classList.add("hidden");
  try{
    const d = await api("/auth/login", { method:"POST", body: JSON.stringify({ email, password }) });
    setToken(d.token);
    const me = await loadMe();
    const role = me.me && me.me.role;
    if(role==="ADMIN") location.href="admin.html";
    else if(role==="HOD") location.href="hod.html";
    else if(role==="TA") location.href="ta.html";
    else if(role==="HR") location.href="hr.html";
    else if(role==="EMP") location.href="emp.html";
    else location.href="login.html";
  }catch(e){
    msg.textContent = e.message || "අසමත් විය";
    msg.classList.remove("hidden");
  }
};
