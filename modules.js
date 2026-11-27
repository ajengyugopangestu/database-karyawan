/* PeopleDesk: Departemen, Kalender, Laporan, Profil, Pengaturan */
(function(){
  const $ = id => document.getElementById(id);
  const originalShowPage = window.showPage;
  window.showPage = function(page){ originalShowPage(page); if(page==="departments") renderDepartments(); if(page==="calendar") renderCalendar(); if(page==="reports") renderReports(); if(page==="profile") renderProfile(); if(page==="settings") renderSettings(); };
  function countBy(key){ const map=new Map(); employees.forEach(e=>{const v=String(e[key]||"Belum diisi").trim();map.set(v,(map.get(v)||0)+1);});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"id")); }
  function renderDepartments(){
    const deps=countBy("department"), pos=new Map();
    employees.forEach(e=>{const p=String(e.position||"Belum diisi").trim(),d=String(e.department||"Belum diisi").trim(),k=p+"|||"+d;pos.set(k,(pos.get(k)||0)+1);});
    $("departmentTable").innerHTML=deps.length?deps.map(x=>"<tr><td>"+escapeHTML(x[0])+"</td><td>"+x[1]+"</td></tr>").join(""):"<tr><td colspan=2>Belum ada data.</td></tr>";
    $("positionTable").innerHTML=pos.size?[...pos.entries()].sort().map(x=>{const p=x[0].split("|||");return "<tr><td>"+escapeHTML(p[0])+"</td><td>"+escapeHTML(p[1])+"</td><td>"+x[1]+"</td></tr>";}).join(""):"<tr><td colspan=3>Belum ada data.</td></tr>";
  }
  let cursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  function renderCalendar(){
    const y=cursor.getFullYear(),m=cursor.getMonth();$("calendarMonthTitle").textContent=cursor.toLocaleDateString("id-ID",{month:"long",year:"numeric"});
    const labels=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];let out=labels.map(x=>"<div class=calendar-weekday>"+x+"</div>").join("");
    for(let i=0;i<new Date(y,m,1).getDay();i++)out+="<div class=\"calendar-day muted\"></div>";
    const total=new Date(y,m+1,0).getDate(),now=new Date();
    for(let d=1;d<=total;d++){const n=employees.filter(e=>{if(!e.birthDate)return false;const p=e.birthDate.split("-").map(Number);return p[1]===m+1&&p[2]===d;}).length;const today=now.getFullYear()===y&&now.getMonth()===m&&now.getDate()===d;out+="<button class=\"calendar-day "+(today?"today ":"")+(n?"has-birthday":"")+"\" data-day=\""+d+"\"><span>"+d+"</span>"+(n?"<small>"+n+" ulang tahun</small>":"")+"</button>";}
    $("birthdayCalendar").innerHTML=out;$("calendarSelected").textContent="Pilih tanggal untuk melihat ulang tahun karyawan.";
  }
  $("calendarPrev").addEventListener("click",()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderCalendar();});
  $("calendarNext").addEventListener("click",()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderCalendar();});
  $("birthdayCalendar").addEventListener("click",ev=>{const b=ev.target.closest("[data-day]");if(!b)return;const d=Number(b.dataset.day),m=cursor.getMonth();const list=employees.filter(e=>{if(!e.birthDate)return false;const p=e.birthDate.split("-").map(Number);return p[1]===m+1&&p[2]===d;});const date=new Date(cursor.getFullYear(),m,d).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});$("calendarSelected").innerHTML="<strong>"+date+"</strong><br>"+(list.length?list.map(e=>escapeHTML(e.name)+" — "+escapeHTML(e.department||"")).join("<br>"):"Tidak ada ulang tahun pada tanggal ini.");});
  function renderReports(){
    $("reportTotal").textContent=employees.length;$("reportPermanent").textContent=employees.filter(e=>e.status==="Tetap").length;$("reportContract").textContent=employees.filter(e=>e.status==="Kontrak").length;$("reportIntern").textContent=employees.filter(e=>e.status==="Magang").length;
    const deps=countBy("department");$("reportDepartmentTable").innerHTML=deps.length?deps.map(x=>{const list=employees.filter(e=>(e.department||"Belum diisi").trim()===x[0]);return "<tr><td>"+escapeHTML(x[0])+"</td><td>"+list.length+"</td><td>"+list.filter(e=>e.status==="Tetap").length+"</td><td>"+list.filter(e=>e.status==="Kontrak").length+"</td><td>"+list.filter(e=>e.status==="Magang").length+"</td></tr>";}).join(""):"<tr><td colspan=5>Belum ada data.</td></tr>";
  }
  $("reportCsv").addEventListener("click",()=>{const rows=[["Departemen","Total","Tetap","Kontrak","Magang"]];countBy("department").forEach(x=>{const a=employees.filter(e=>(e.department||"Belum diisi").trim()===x[0]);rows.push([x[0],a.length,a.filter(e=>e.status==="Tetap").length,a.filter(e=>e.status==="Kontrak").length,a.filter(e=>e.status==="Magang").length]);});const csv=rows.map(r=>r.map(v=>"\""+String(v).replace(/"/g,"\"\"")+"\"").join(",")).join("\r\n");const u=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=u;a.download="laporan_karyawan_"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(u);});
  $("printReport").addEventListener("click",()=>window.print());
  function renderProfile(){if(!currentUser)return;$("profileAvatar").textContent=initials(currentUser.fullName||currentUser.username);$("profileFullName").textContent=currentUser.fullName||currentUser.username;$("profileUsername").textContent="@"+currentUser.username;$("profileRole").textContent=String(currentUser.role).toUpperCase();}
  $("changePasswordForm").addEventListener("submit",async ev=>{ev.preventDefault();$("passwordChangeError").textContent="";const currentPassword=$("currentPassword").value,newPassword=$("newPassword").value;if(newPassword.length<12){$("passwordChangeError").textContent="Password baru minimal 12 karakter.";return;}if(newPassword!==$("confirmPassword").value){$("passwordChangeError").textContent="Konfirmasi password tidak sama.";return;}try{const r=await apiRequest("/api/change-password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});$("changePasswordForm").reset();showToast(r.message||"Password berhasil diperbarui.");}catch(e){$("passwordChangeError").textContent=e.message||"Gagal mengganti password.";}});
  function renderSettings(){if(currentUser)$("settingsRole").textContent=String(currentUser.role).toUpperCase();}
  $("settingsBirthdayNotify").addEventListener("click",()=>$("enableBirthdayNotifications").click());
})();