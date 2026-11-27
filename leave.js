(function(){
  const $=id=>document.getElementById(id);
  let requests=[],balances=[];
  const manager=()=>window.currentUser&&["admin","hr"].includes(window.currentUser.role);
  const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
  const year=()=>$("leaveYear").value||String(new Date().getFullYear());
  const statusLabel=s=>({pending:"Menunggu",approved:"Disetujui",rejected:"Ditolak",cancelled:"Dibatalkan"}[s]||s);
  const dateLabel=s=>s?new Date(s+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"—";
  const originalShowPage=window.showPage;
  window.showPage=function(page){originalShowPage(page);if(page==="leave"){$("pageTitle").textContent="Pengajuan Cuti";prepareLeave();loadLeave().catch(e=>showToast(e.message||"Gagal memuat cuti."));}};
  function prepareLeave(){
    const y=new Date().getFullYear();
    if(!$("leaveYear").options.length){$("leaveYear").innerHTML=[y-1,y,y+1].map(v=>'<option value="'+v+'">'+v+'</option>').join("");$("leaveYear").value=String(y);}
    $("leaveEmployeeWrap").hidden=!manager();
    $("leaveEmployee").innerHTML='<option value="">Pilih karyawan</option>'+employees.map(e=>'<option value="'+escapeHTML(e.id)+'">'+escapeHTML(e.name)+' — '+escapeHTML(e.nik)+'</option>').join("");
    if(!$("leaveStart").value)$("leaveStart").value=today();
    if(!$("leaveEnd").value)$("leaveEnd").value=today();
  }
  async function loadLeave(){
    $("leaveRows").innerHTML='<tr><td colspan="7">Memuat data...</td></tr>';
    const result=await apiRequest("/api/leave-requests?year="+encodeURIComponent(year()),{method:"GET"});
    requests=Array.isArray(result.requests)?result.requests:[];
    balances=Array.isArray(result.balances)?result.balances:[];
    renderBalances();renderRequests();
  }
  function renderBalances(){
    const list=manager()?balances:balances.slice(0,1);
    $("leaveBalanceCards").innerHTML=list.length?list.map(b=>'<article class="stat-card leave-balance-card"><div class="stat-label">'+(manager()?escapeHTML(b.name):"Kuota Cuti Tahunan")+'</div><div class="stat-value">'+b.remaining+' <small>/ '+b.quota+' hari</small></div><div class="stat-foot">Disetujui '+b.approved+' hari · Menunggu '+b.pending+' hari</div><div class="leave-progress"><i style="width:'+Math.min(100,b.quota?((b.approved+b.pending)/b.quota*100):0)+'%"></i></div><div class="leave-eligibility">'+(b.eligible?"Memenuhi masa kerja lebih dari 1 tahun":"Belum memenuhi masa kerja lebih dari 1 tahun")+'</div></article>').join(""):'<div class="notice">Data karyawan belum terhubung dengan akun Anda. Hubungi Admin/HR.</div>';
    if(!manager()&&list[0]&&!list[0].eligible){$("leaveForm").querySelector('button[type="submit"]').disabled=true;$("leaveFormMessage").textContent="Anda belum memenuhi masa kerja lebih dari 1 tahun untuk cuti tahunan.";}
    else {$("leaveForm").querySelector('button[type="submit"]').disabled=false;if(!$("leaveFormMessage").textContent.includes("gagal"))$("leaveFormMessage").textContent="";}
  }
  function renderRequests(){
    $("leaveRows").innerHTML=requests.length?requests.map(r=>'<tr><td><strong>'+escapeHTML(r.name||"")+'</strong><small class="leave-sub">'+escapeHTML(r.nik||"")+'</small></td><td>'+dateLabel(r.startDate)+' – '+dateLabel(r.endDate)+'</td><td>'+r.days+' hari</td><td>'+escapeHTML(r.reason)+'</td><td><span class="leave-status leave-'+r.status+'">'+statusLabel(r.status)+'</span></td><td>'+escapeHTML(r.decisionNote||"—")+'</td><td class="leave-action-col">'+(manager()&&r.status==="pending"?'<div class="leave-actions"><button class="btn btn-primary btn-small" data-leave-action="approved" data-id="'+r.id+'">Setujui</button><button class="btn btn-light btn-small" data-leave-action="rejected" data-id="'+r.id+'">Tolak</button></div>':"—")+'</td></tr>').join(""):'<tr><td colspan="7">Belum ada pengajuan cuti pada tahun ini.</td></tr>';
    document.querySelectorAll(".leave-action-col").forEach(el=>el.hidden=!manager());
  }
  $("leaveForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const payload={startDate:$("leaveStart").value,endDate:$("leaveEnd").value,reason:$("leaveReason").value.trim()};
    if(manager())payload.employeeId=Number($("leaveEmployee").value);
    if(manager()&&!payload.employeeId){$("leaveFormMessage").textContent="Pilih karyawan terlebih dahulu.";return;}
    $("leaveFormMessage").textContent="Mengirim pengajuan...";
    try{const result=await apiRequest("/api/leave-requests",{method:"POST",body:JSON.stringify(payload)});$("leaveFormMessage").textContent=result.message+" ("+result.days+" hari kerja).";$("leaveReason").value="";await loadLeave();showToast("Pengajuan cuti berhasil dikirim.");}
    catch(err){$("leaveFormMessage").textContent=err.message||"Pengajuan gagal dikirim.";}
  });
  $("leaveRows").addEventListener("click",async e=>{
    const b=e.target.closest("[data-leave-action]");if(!b)return;
    const decisionNote=prompt(b.dataset.leaveAction==="approved"?"Catatan persetujuan (opsional):":"Alasan penolakan:");
    if(decisionNote===null)return;
    if(b.dataset.leaveAction==="rejected"&&!decisionNote.trim()){showToast("Alasan penolakan wajib diisi.");return;}
    b.disabled=true;
    try{const result=await apiRequest("/api/leave-requests/"+encodeURIComponent(b.dataset.id),{method:"PUT",body:JSON.stringify({status:b.dataset.leaveAction,decisionNote})});showToast(result.message);await loadLeave();}
    catch(err){showToast(err.message||"Gagal memproses pengajuan.");b.disabled=false;}
  });
  $("leaveYear").addEventListener("change",()=>loadLeave().catch(e=>showToast(e.message)));
  const observer=setInterval(()=>{if(window.currentUser&&employees.length){prepareLeave();clearInterval(observer);}},400);
})();