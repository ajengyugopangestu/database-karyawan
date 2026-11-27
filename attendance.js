(function(){
  const $ = id => document.getElementById(id);
  let records = [];
  const isManager = () => currentUser && ['admin','hr'].includes(currentUser.role);
  const localISODate = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const monthValue = () => $('attendanceMonth').value || localISODate().slice(0,7);
  const originalShowPage = window.showPage;
  window.showPage = function(page){ originalShowPage(page); if(page==='attendance'){ $('pageTitle').textContent='Absensi'; prepareForm(); loadAttendance().catch(e=>showToast(e.message||'Gagal memuat absensi.')); } };
  function prepareForm(){
    $('attendanceEmployee').innerHTML='<option value="">Pilih karyawan</option>'+employees.map(e=>'<option value="'+escapeHTML(e.id)+'">'+escapeHTML(e.name)+' — '+escapeHTML(e.nik)+'</option>').join('');
    const deps=[...new Set(employees.map(e=>String(e.department||'').trim()).filter(Boolean))].sort();
    $('attendanceDepartment').innerHTML='<option value="">Semua Departemen</option>'+deps.map(d=>'<option value="'+escapeHTML(d)+'">'+escapeHTML(d)+'</option>').join('');
    if(!$('attendanceDate').value)$('attendanceDate').value=localISODate();
  }
  async function loadAttendance(){
    $('attendanceRows').innerHTML='<tr><td colspan="9">Memuat data...</td></tr>';
    const result=await apiRequest('/api/attendance?month='+encodeURIComponent(monthValue()),{method:'GET'});
    records=Array.isArray(result.attendance)?result.attendance:[];
    $('attendancePeriodLabel').textContent=new Date(monthValue()+'-01T00:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    prepareForm(); renderAttendance();
  }
  function filtered(){
    const q=$('attendanceSearch').value.trim().toLowerCase(),dep=$('attendanceDepartment').value;
    return records.filter(r=>(!dep||r.department===dep)&&(!q||String(r.name||'').toLowerCase().includes(q)||String(r.nik||'').toLowerCase().includes(q)));
  }
  function renderAttendance(){
    const list=filtered();
    $('attendanceTotal').textContent=list.length;
    $('attendancePresent').textContent=list.filter(r=>r.status==='Hadir').length;
    $('attendancePermit').textContent=list.filter(r=>r.status==='Izin').length;
    $('attendanceSick').textContent=list.filter(r=>r.status==='Sakit').length;
    $('attendanceAbsent').textContent=list.filter(r=>r.status==='Alpha').length;
    $('attendanceRows').innerHTML=list.length?list.map(r=>{const date=new Date(r.attendanceDate+'T00:00:00').toLocaleDateString('id-ID');return '<tr><td>'+date+'</td><td>'+escapeHTML(r.nik)+'</td><td>'+escapeHTML(r.name)+'</td><td>'+escapeHTML(r.department||'—')+'</td><td><span class="attendance-status status-'+r.status.toLowerCase()+'">'+r.status+'</span></td><td>'+escapeHTML(r.checkIn||'—')+'</td><td>'+escapeHTML(r.checkOut||'—')+'</td><td>'+escapeHTML(r.notes||'—')+'</td><td class="attendance-manage-col">'+(isManager()?'<button class="btn btn-light btn-small" data-attendance-edit="'+r.employeeId+'" data-date="'+r.attendanceDate+'">Edit</button>':'—')+'</td></tr>';}).join(''):'<tr><td colspan="9">Belum ada catatan absensi untuk periode/filter ini.</td></tr>';
    $('attendanceEntry').hidden=!isManager();$('attendanceAdminActions').hidden=false;
    document.querySelectorAll('.attendance-manage-col').forEach(el=>el.hidden=!isManager());
  }
  $('attendanceForm').addEventListener('submit',async ev=>{
    ev.preventDefault();if(!isManager())return;
    $('attendanceFormMessage').textContent='Menyimpan...';
    const payload={employeeId:Number($('attendanceEmployee').value),date:$('attendanceDate').value,status:$('attendanceStatus').value,checkIn:$('attendanceCheckIn').value,checkOut:$('attendanceCheckOut').value,notes:$('attendanceNotes').value};
    try{const result=await apiRequest('/api/attendance',{method:'POST',body:JSON.stringify(payload)});$('attendanceFormMessage').textContent=result.message||'Absensi tersimpan.';await loadAttendance();$('attendanceEmployee').value='';$('attendanceDate').value=localISODate();$('attendanceCheckIn').value='';$('attendanceCheckOut').value='';$('attendanceNotes').value='';showToast('Absensi berhasil disimpan.');}
    catch(error){$('attendanceFormMessage').textContent=error.message||'Gagal menyimpan absensi.';}
  });
  $('attendanceRows').addEventListener('click',ev=>{const b=ev.target.closest('[data-attendance-edit]');if(!b)return;const r=records.find(x=>String(x.employeeId)===b.dataset.attendanceEdit&&x.attendanceDate===b.dataset.date);if(!r)return;$('attendanceEmployee').value=r.employeeId;$('attendanceDate').value=r.attendanceDate;$('attendanceStatus').value=r.status;$('attendanceCheckIn').value=r.checkIn||'';$('attendanceCheckOut').value=r.checkOut||'';$('attendanceNotes').value=r.notes||'';$('attendanceFormMessage').textContent='Mode edit: '+r.name+' — '+r.attendanceDate;window.scrollTo({top:$('attendanceEntry').offsetTop,behavior:'smooth'});});
  $('attendanceRefresh').addEventListener('click',()=>loadAttendance().catch(e=>showToast(e.message)));
  $('attendanceMonth').addEventListener('change',()=>loadAttendance().catch(e=>showToast(e.message)));
  $('attendanceSearch').addEventListener('input',renderAttendance);$('attendanceDepartment').addEventListener('change',renderAttendance);
  $('attendanceReset').addEventListener('click',()=>{setTimeout(()=>{$('attendanceDate').value=localISODate();$('attendanceFormMessage').textContent='';},0);});
  $('attendanceExport').addEventListener('click',()=>{
    const list=filtered(),month=monthValue();
    if(!window.XLSX){showToast('Library Excel belum termuat. Periksa koneksi internet lalu coba lagi.');return;}
    const visibleEmployees=employees.filter(e=>(isManager()||String(e.name).toLowerCase()===String(currentUser.fullName||'').toLowerCase())&&(!$('attendanceDepartment').value||e.department===$('attendanceDepartment').value)&&(! $('attendanceSearch').value.trim()||String(e.name).toLowerCase().includes($('attendanceSearch').value.trim().toLowerCase())||String(e.nik).toLowerCase().includes($('attendanceSearch').value.trim().toLowerCase())));
    const byEmployee=new Map(visibleEmployees.map(e=>[String(e.id),{nik:e.nik,name:e.name,department:e.department||'',Hadir:0,Izin:0,Sakit:0,Cuti:0,Alpha:0,total:0}]));
    list.forEach(r=>{if(!byEmployee.has(String(r.employeeId)))byEmployee.set(String(r.employeeId),{nik:r.nik,name:r.name,department:r.department||'',Hadir:0,Izin:0,Sakit:0,Cuti:0,Alpha:0,total:0});const x=byEmployee.get(String(r.employeeId));x[r.status]=(x[r.status]||0)+1;x.total++;});
    const summary=[...byEmployee.values()].map(x=>({'NIK':x.nik,'Nama Karyawan':x.name,'Departemen':x.department,'Hadir':x.Hadir,'Izin':x.Izin,'Sakit':x.Sakit,'Cuti':x.Cuti,'Alpha':x.Alpha,'Total Catatan':x.total,'Persentase Hadir':x.total?Math.round(x.Hadir/x.total*10000)/100+'%':'0%'}));
    const detail=list.map(r=>({'Tanggal':r.attendanceDate,'NIK':r.nik,'Nama Karyawan':r.name,'Departemen':r.department||'','Status':r.status,'Jam Masuk':r.checkIn||'','Jam Pulang':r.checkOut||'','Keterangan':r.notes||''}));
    const wb=XLSX.utils.book_new();
    const ws1=XLSX.utils.json_to_sheet(summary);ws1['!cols']=[{wch:18},{wch:28},{wch:22},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:16},{wch:20}];
    const ws2=XLSX.utils.json_to_sheet(detail);ws2['!cols']=[{wch:14},{wch:18},{wch:28},{wch:22},{wch:12},{wch:12},{wch:12},{wch:32}];
    XLSX.utils.book_append_sheet(wb,ws1,'Rekap Bulanan');XLSX.utils.book_append_sheet(wb,ws2,'Detail Absensi');
    XLSX.writeFile(wb,'Rekap_Absensi_'+month+'.xlsx');
  });
  const originalInit=window.initializeApplication;
  if(typeof originalInit==='function'){const wrapped=window.initializeApplication;}
  const observer=setInterval(()=>{if(currentUser&&employees.length){prepareForm();clearInterval(observer);}},500);
})();