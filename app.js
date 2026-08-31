(() => {
  const cfg = window.FYP_CONFIG || {};
  const app = document.getElementById('app');
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseUrl.includes('YOUR_PROJECT')) {
    app.innerHTML = `<div class="auth"><div class="card"><h2>Configuration needed</h2><p>Copy <b>config.example.js</b> to <b>config.js</b>, then add your Supabase project URL and anon/publishable key.</p></div></div>`;
    return;
  }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const state = { user:null, profile:null, view:'dashboard', cohorts:[], students:[], projects:[], tasks:[], assignments:[], submissions:[], feedback:[], meetingSlots:[], meetingBookings:[], files:[], studentRecord:null };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmt = d => d ? new Date(d).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : '—';
  const dateOnly = d => d ? new Date(d).toLocaleDateString([], {dateStyle:'medium'}) : '—';
  const now = () => new Date();
  const isAdmin = () => ['admin','supervisor'].includes(state.profile?.role);
  const roleLabel = () => isAdmin() ? 'Admin' : 'Student';
  const q = sel => document.querySelector(sel);

  async function init(){
    const {data:{session}} = await sb.auth.getSession();
    state.user = session?.user || null;
    if (!state.user) return renderAuth();
    await loadProfile();
    await loadData();
    render();
  }

  async function loadProfile(){
    const {data,error} = await sb.from('profiles').select('*').eq('id',state.user.id).maybeSingle();
    if(error) console.error(error);
    state.profile = data || {id:state.user.id, full_name:state.user.email, role:'student'};
  }

  async function loadData(){
    const fetches = [
      sb.from('academic_years').select('*').order('start_year',{ascending:false}),
      sb.from('students').select('*').order('created_at',{ascending:false}),
      sb.from('projects').select('*'),
      sb.from('tasks').select('*').order('due_at',{ascending:true}),
      sb.from('task_assignments').select('*'),
      sb.from('submissions').select('*').order('submitted_at',{ascending:false}),
      sb.from('feedback').select('*').order('created_at',{ascending:false}),
      sb.from('meeting_slots').select('*').order('start_at',{ascending:true}),
      sb.from('meeting_bookings').select('*').order('booked_at',{ascending:false})
    ];
    const [coh,stu,pro,tas,ass,sub,fee,slots,books] = await Promise.all(fetches);
    state.cohorts=coh.data||[]; state.students=stu.data||[]; state.projects=pro.data||[]; state.tasks=tas.data||[]; state.assignments=ass.data||[]; state.submissions=sub.data||[]; state.feedback=fee.data||[]; state.meetingSlots=slots.data||[]; state.meetingBookings=books.data||[];
    if(!isAdmin()) state.studentRecord = state.students.find(s=>s.profile_id===state.user.id || (s.email||'').toLowerCase()===(state.user.email||'').toLowerCase()) || null;
  }

  function renderAuth(){
    app.innerHTML = `<div class="auth"><div class="brandbox"><h1>FYP Supervision Portal</h1><p class="muted">Research progress, evidence and supervision records in one place.</p></div><div class="card"><div class="tabs"><button class="btn" id="tabLogin">Sign in</button><button class="btn secondary" id="tabSignup">Create account</button></div><form id="authForm" class="form-grid"><div class="field full"><label>Email</label><input id="email" type="email" required></div><div class="field full"><label>Password</label><input id="password" type="password" minlength="6" required></div><div class="field full signup-only" style="display:none"><label>Full name</label><input id="fullName"></div><div class="field full"><div id="authMsg" class="help"></div></div><div class="field full"><button class="btn" id="authSubmit">Sign in</button></div></form></div></div>`;
    let mode='login';
    q('#tabLogin').onclick=()=>{mode='login'; q('#tabLogin').className='btn'; q('#tabSignup').className='btn secondary'; q('.signup-only').style.display='none'; q('#authSubmit').textContent='Sign in';};
    q('#tabSignup').onclick=()=>{mode='signup'; q('#tabSignup').className='btn'; q('#tabLogin').className='btn secondary'; q('.signup-only').style.display='flex'; q('#authSubmit').textContent='Create account';};
    q('#authForm').onsubmit=async e=>{e.preventDefault(); const email=q('#email').value.trim(),password=q('#password').value,full_name=q('#fullName').value.trim(); q('#authSubmit').disabled=true; q('#authMsg').textContent='Working…';
      const redirectTo = window.location.origin + window.location.pathname;
      const r = mode==='login' ? await sb.auth.signInWithPassword({email,password}) : await sb.auth.signUp({email,password,options:{data:{full_name},emailRedirectTo:redirectTo}});
      q('#authSubmit').disabled=false; if(r.error){q('#authMsg').textContent=r.error.message;return;} if(mode==='signup' && !r.data.session){q('#authMsg').textContent='Account created. Check your email to confirm, then sign in.';return;} await init();
    };
  }

  function nav(){
    const items = isAdmin() ? [['dashboard','Dashboard'],['students','Students'],['tasks','Tasks'],['meetings','Meetings'],['submissions','Submissions'],['progress','Progress'],['cohorts','Cohorts'],['export','Export']] : [['dashboard','My FYP'],['tasks','My Tasks'],['meetings','Book Meeting'],['submissions','My Submissions'],['progress','Progress'],['export','Export Record']];
    return `<div class="nav">${items.map(([v,l])=>`<button data-view="${v}" class="${state.view===v?'active':''}">${l}</button>`).join('')}</div>`;
  }
  function render(){
    app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">FYP Portal<small>Supervision Management System</small></div>${nav()}<div class="account"><div>${esc(state.profile?.full_name||state.user.email)}</div><div class="tiny">${esc(roleLabel())}</div><button id="signout" class="btn secondary small" style="margin-top:10px">Sign out</button></div></aside><main class="main"><div id="view"></div></main></div>`;
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render();});
    q('#signout').onclick=async()=>{await sb.auth.signOut();state.user=null;renderAuth();};
    const target=q('#view');
    if(state.view==='dashboard') target.innerHTML=isAdmin()?supervisorDashboard():studentDashboard();
    if(state.view==='students') target.innerHTML=studentsView();
    if(state.view==='tasks') target.innerHTML=isAdmin()?tasksSupervisor():tasksStudent();
    if(state.view==='meetings') target.innerHTML=meetingsView();
    if(state.view==='submissions') target.innerHTML=submissionsView();
    if(state.view==='progress') target.innerHTML=progressView();
    if(state.view==='cohorts') target.innerHTML=cohortsView();
    if(state.view==='export') target.innerHTML=exportView();
    bindViewActions();
  }

  function top(title,desc,button=''){return `<div class="topbar"><div><h1>${title}</h1><p>${desc}</p></div>${button}</div>`;}
  function projectForStudent(id){return state.projects.find(p=>p.student_id===id);}
  function assignmentFor(taskId,studentId){return state.assignments.find(a=>a.task_id===taskId&&a.student_id===studentId);}
  function latestSubmission(taskId,studentId){return state.submissions.find(s=>s.task_id===taskId&&s.student_id===studentId);}
  function assignmentStatus(task,studentId){const s=latestSubmission(task.id,studentId); if(s){if(s.status==='approved')return ['Approved','ok'];if(s.status==='revision_required')return ['Revision','warn'];if(new Date(s.submitted_at)>new Date(task.due_at))return ['Late submitted','bad'];return ['Submitted','ok'];} if(task.due_at && new Date(task.due_at)<now())return ['Overdue','bad']; return ['Pending','warn'];}

  function supervisorDashboard(){
    const currentCohort=state.cohorts[0];
    let overdue=0,pendingReview=0,approved=0; state.assignments.forEach(a=>{const t=state.tasks.find(x=>x.id===a.task_id); if(!t)return; const s=latestSubmission(t.id,a.student_id); if(!s&&t.due_at&&new Date(t.due_at)<now())overdue++; if(s&&['submitted','resubmitted'].includes(s.status))pendingReview++; if(s?.status==='approved')approved++;});
    return top('FYP Admin Dashboard',currentCohort?`Current cohort: ${esc(currentCohort.label)}`:'Create your first academic year to begin.',`<button class="btn" id="newTask">+ New Task</button>`)+
      `<div class="grid cols-4"><div class="card kpi"><div class="label">Students</div><div class="value">${state.students.length}</div><div class="hint">Across visible cohorts</div></div><div class="card kpi"><div class="label">Pending review</div><div class="value">${pendingReview}</div><div class="hint">Submitted work awaiting you</div></div><div class="card kpi"><div class="label">Overdue</div><div class="value">${overdue}</div><div class="hint">No submission after deadline</div></div><div class="card kpi"><div class="label">Approved</div><div class="value">${approved}</div><div class="hint">Approved task submissions</div></div></div>`+
      `<div class="section-title"><h2>Student overview</h2><button class="btn secondary small" id="newStudent">+ Add Student</button></div>`+
      studentOverviewTable();
  }

  function studentOverviewTable(){
    if(!state.students.length)return `<div class="empty">No students yet.</div>`;
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Project</th><th>Cohort</th><th>Tasks</th><th>Progress</th><th>Status</th></tr></thead><tbody>${state.students.map(s=>{const p=projectForStudent(s.id);const assigns=state.assignments.filter(a=>a.student_id===s.id);const app=assigns.filter(a=>{const sub=latestSubmission(a.task_id,s.id);return sub?.status==='approved'}).length;const pct=assigns.length?Math.round(app/assigns.length*100):0;const hasOverdue=assigns.some(a=>{const t=state.tasks.find(x=>x.id===a.task_id);return t&&!latestSubmission(t.id,s.id)&&t.due_at&&new Date(t.due_at)<now()});return `<tr><td><b>${esc(s.full_name)}</b><div class="tiny muted">${esc(s.email||'')}</div></td><td>${esc(p?.title||'—')}</td><td>${esc(state.cohorts.find(c=>c.id===s.academic_year_id)?.label||'—')}</td><td>${app}/${assigns.length} approved</td><td><div class="progress"><span style="width:${pct}%"></span></div><div class="tiny muted">${pct}%</div></td><td><span class="pill ${hasOverdue?'bad':'ok'}">${hasOverdue?'Needs attention':'On track'}</span></td></tr>`}).join('')}</tbody></table></div>`;
  }

  function studentDashboard(){
    const s=state.studentRecord;if(!s)return top('My FYP','Your account is not linked to a student record yet.')+`<div class="notice bad">Ask your FYP administrator to add your exact sign-in email to the student list.</div>`;
    const p=projectForStudent(s.id), assigns=state.assignments.filter(a=>a.student_id===s.id).map(a=>state.tasks.find(t=>t.id===a.task_id)).filter(Boolean).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
    const pending=assigns.filter(t=>!latestSubmission(t.id,s.id));const next=pending[0];const approved=assigns.filter(t=>latestSubmission(t.id,s.id)?.status==='approved').length;const pct=assigns.length?Math.round(approved/assigns.length*100):0;
    return top('My FYP',esc(p?.title||'FYP project'))+`<div class="grid cols-3"><div class="card kpi"><div class="label">Overall approved</div><div class="value">${pct}%</div></div><div class="card kpi"><div class="label">Tasks approved</div><div class="value">${approved}/${assigns.length}</div></div><div class="card kpi"><div class="label">Next deadline</div><div class="value" style="font-size:20px">${next?dateOnly(next.due_at):'None'}</div></div></div>`+
      `<div class="section-title"><h2>Next task</h2></div>${next?taskCard(next,s.id,true):`<div class="empty">No upcoming task.</div>`}`+
      `<div class="section-title"><h2>Recent tasks</h2></div><div class="grid cols-2">${assigns.slice(0,6).map(t=>taskCard(t,s.id,true)).join('')||'<div class="empty">No tasks assigned yet.</div>'}</div>`;
  }

  function taskCard(t,studentId,studentMode=false){const [label,cls]=assignmentStatus(t,studentId);const sub=latestSubmission(t.id,studentId);return `<div class="card task-card"><div><h3>${esc(t.title)}</h3><p>${esc((t.instructions||'').slice(0,180))}</p><div class="task-meta"><span class="pill accent">${esc(t.stage||'General')}</span><span class="pill">Due ${fmt(t.due_at)}</span><span class="pill ${cls}">${label}</span></div></div>${studentMode?`<button class="btn small openTask" data-task="${t.id}" data-student="${studentId}">${sub?'View / Revise':'Open'}</button>`:''}</div>`;}

  function studentsView(){return top('Students','Add students now and continue adding new cohorts in future years.',`<button class="btn" id="newStudent">+ Add Student</button>`)+studentOverviewTable();}

  function tasksSupervisor(){
    return top('Tasks','Create individual or shared FYP tasks with deadlines and required evidence.',`<button class="btn" id="newTask">+ New Task</button>`)+`<div class="grid cols-2">${state.tasks.map(t=>{const ass=state.assignments.filter(a=>a.task_id===t.id);return `<div class="card"><div class="task-card"><div><h3>${esc(t.title)}</h3><p>${esc(t.instructions||'')}</p><div class="task-meta"><span class="pill accent">${esc(t.stage||'General')}</span><span class="pill">${fmt(t.due_at)}</span><span class="pill">${ass.length} student${ass.length===1?'':'s'}</span></div></div><button class="btn secondary small reviewTask" data-task="${t.id}">Review</button></div></div>`}).join('')||'<div class="empty">No tasks created yet.</div>'}</div>`;
  }
  function tasksStudent(){const s=state.studentRecord;if(!s)return top('My Tasks','Student record not linked.');const tasks=state.assignments.filter(a=>a.student_id===s.id).map(a=>state.tasks.find(t=>t.id===a.task_id)).filter(Boolean);return top('My Tasks','Complete each task and attach evidence before the deadline.')+`<div class="grid cols-2">${tasks.map(t=>taskCard(t,s.id,true)).join('')||'<div class="empty">No tasks assigned.</div>'}</div>`;}


  function bookingForSlot(slotId){return state.meetingBookings.find(b=>b.slot_id===slotId);}
  function meetingStatus(slot){const b=bookingForSlot(slot.id);if(b)return ['Booked','ok'];if(new Date(slot.end_at)<now())return ['Past',''];return ['Available','accent'];}

  function meetingsView(){
    if(isAdmin()){
      const rows=state.meetingSlots.map(slot=>{const b=bookingForSlot(slot.id),stu=b?state.students.find(s=>s.id===b.student_id):null,[lab,cl]=meetingStatus(slot);return `<tr><td>${fmt(slot.start_at)}</td><td>${fmt(slot.end_at)}</td><td>${esc(slot.location||'')}</td><td><span class="pill ${cl}">${lab}</span></td><td>${b?`${esc(stu?.full_name||'')}<div class="tiny muted">${esc(projectForStudent(stu?.id)?.title||'')}</div>`:'—'}</td></tr>`}).join('');
      return top('FYP Supervision Meetings','Set your own availability here. Students can book one available slot; no calendar connection is used.',`<div class="top-actions"><button class="btn secondary" id="emailStudents">Email All Students</button><button class="btn" id="newMeetingSlot">+ Add Availability</button></div>`)+
      `<div class="card"><h3 style="margin-top:0">Student & project list</h3>${studentProjectList()}</div><div class="section-title"><h2>Availability & bookings</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Start</th><th>End</th><th>Location / Mode</th><th>Status</th><th>Booked by</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">No availability slots yet. Add the times you are free this week.</td></tr>'}</tbody></table></div>`;
    }
    const stu=state.studentRecord;if(!stu)return top('Book Supervision Meeting','Your student record is not linked yet.');
    const myBooking=state.meetingBookings.find(b=>b.student_id===stu.id && new Date(state.meetingSlots.find(s=>s.id===b.slot_id)?.end_at||0)>=now());
    const available=state.meetingSlots.filter(slot=>!bookingForSlot(slot.id)&&new Date(slot.start_at)>now());
    return top('Book Supervision Meeting','Choose one of your supervisor’s available FYP supervision slots.')+
      `${myBooking?(()=>{const sl=state.meetingSlots.find(s=>s.id===myBooking.slot_id);return `<div class="notice ok"><b>Your upcoming meeting is booked:</b> ${fmt(sl?.start_at)} – ${fmt(sl?.end_at)}${sl?.location?` · ${esc(sl.location)}`:''}</div>`})():''}`+
      `<div class="grid cols-2" style="margin-top:16px">${available.map(slot=>`<div class="card"><h3>${dateOnly(slot.start_at)}</h3><p><b>${new Date(slot.start_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} – ${new Date(slot.end_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</b></p><p class="muted">${esc(slot.location||'FYP supervision meeting')}</p><button class="btn bookMeeting" data-slot="${slot.id}">Book this slot</button></div>`).join('')||'<div class="empty">No available meeting slots at the moment.</div>'}</div>`;
  }

  function studentProjectList(){
    if(!state.students.length)return '<div class="muted">No students have been added yet.</div>';
    return `<div class="project-list">${state.students.map(s=>`<div class="project-person"><div><strong>${esc(s.full_name)}</strong><div class="tiny muted">${esc(s.email||'')}</div></div><div>${esc(projectForStudent(s.id)?.title||'Project not assigned')}</div></div>`).join('')}</div>`;
  }

  function openMeetingSlotModal(){const m=modal(`<h2>Add Supervision Availability</h2><form id="slotForm" class="form-grid"><div class="field"><label>Start</label><input id="slotStart" type="datetime-local" required></div><div class="field"><label>End</label><input id="slotEnd" type="datetime-local" required></div><div class="field full"><label>Location / meeting mode</label><input id="slotLocation" placeholder="e.g. Office, FIT Meeting Room, Microsoft Teams"></div><div class="field full"><label>Note for students (optional)</label><textarea id="slotNote" placeholder="e.g. Bring your latest report draft and evidence of this week’s work."></textarea></div><div class="actions field full">${closeBtn()}<button class="btn">Publish Slot</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#slotForm').onsubmit=async e=>{e.preventDefault();const start=m.querySelector('#slotStart').value,end=m.querySelector('#slotEnd').value;if(new Date(end)<=new Date(start))return alert('End time must be after start time.');const r=await sb.from('meeting_slots').insert({start_at:start,end_at:end,location:m.querySelector('#slotLocation').value.trim(),note:m.querySelector('#slotNote').value.trim(),created_by:state.user.id});if(r.error)return alert(r.error.message);m.remove();await loadData();render();};}

  async function bookMeeting(slotId){const stu=state.studentRecord;if(!stu)return alert('Your student record is not linked.');const existing=state.meetingBookings.find(b=>b.student_id===stu.id&&new Date(state.meetingSlots.find(s=>s.id===b.slot_id)?.end_at||0)>=now());if(existing)return alert('You already have an upcoming meeting booked.');const r=await sb.from('meeting_bookings').insert({slot_id:slotId,student_id:stu.id});if(r.error)return alert(r.error.message);await loadData();render();}

  function emailAllStudents(){
    if(!state.students.length)return alert('Add student email addresses first.');
    const cohort=state.cohorts.find(c=>c.is_active)||state.cohorts[0];
    const students=state.students.filter(s=>!cohort||s.academic_year_id===cohort.id);
    const emails=students.map(s=>s.email).filter(Boolean);
    if(!emails.length)return alert('No student email addresses are available.');
    const portalUrl=location.href.split('#')[0];
    const projectLines=students.map(s=>`- ${s.full_name}: ${projectForStudent(s.id)?.title||'FYP project'}`).join('\n');
    const available=state.meetingSlots.filter(sl=>!bookingForSlot(sl.id)&&new Date(sl.start_at)>now()).slice(0,12);
    const slotLines=available.length?available.map(sl=>`- ${fmt(sl.start_at)} to ${new Date(sl.end_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${sl.location?` (${sl.location})`:''}`).join('\n'):'Please check the portal for the latest available slots.';
    const subject=`FYP Supervision Meeting - ${cohort?.label||'Current Cohort'}`;
    const body=`Dear all,\n\nI hope you are well. For reference, your assigned FYP projects are:\n\n${projectLines}\n\nMy current supervision availability is:\n${slotLines}\n\nPlease log in to the FYP Supervision Portal and book ONE available meeting slot. Slots are first-come, first-served and a booked slot will no longer be available to the other students.\n\nPortal: ${portalUrl}\n\nBefore the meeting, please update your FYP progress and upload the relevant evidence for the work completed.\n\nThank you.`;
    const url=`mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href=url;
  }

  function submissionsView(){
    const subs=isAdmin()?state.submissions:state.submissions.filter(s=>s.student_id===state.studentRecord?.id);
    return top(isAdmin()?'Submissions':'My Submissions',isAdmin()?'Review evidence, request revisions, and approve completed work.':'Your submission history stays as part of your FYP evidence record.')+
      `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Task</th><th>Submitted</th><th>Status</th><th>Summary</th><th></th></tr></thead><tbody>${subs.map(s=>{const stu=state.students.find(x=>x.id===s.student_id),t=state.tasks.find(x=>x.id===s.task_id);return `<tr><td>${esc(stu?.full_name||'')}</td><td>${esc(t?.title||'')}</td><td>${fmt(s.submitted_at)}</td><td><span class="pill ${s.status==='approved'?'ok':s.status==='revision_required'?'warn':''}">${esc(s.status)}</span></td><td>${esc((s.summary||'').slice(0,120))}</td><td><button class="btn secondary small openSubmission" data-id="${s.id}">Open</button></td></tr>`}).join('')||'<tr><td colspan="6" class="muted">No submissions yet.</td></tr>'}</tbody></table></div>`;
  }

  function progressView(){
    const students=isAdmin()?state.students:(state.studentRecord?[state.studentRecord]:[]);
    return top('Progress','Approved tasks count toward progress; overdue tasks are highlighted automatically.')+`<div class="grid cols-2">${students.map(s=>{const assigns=state.assignments.filter(a=>a.student_id===s.id), approved=assigns.filter(a=>latestSubmission(a.task_id,s.id)?.status==='approved').length,pct=assigns.length?Math.round(approved/assigns.length*100):0;const rows=assigns.map(a=>{const t=state.tasks.find(x=>x.id===a.task_id);if(!t)return'';const [lab,cl]=assignmentStatus(t,s.id);return `<div class="log-entry"><strong>${esc(t.title)}</strong><span class="pill ${cl}">${lab}</span> <span class="tiny muted">Due ${fmt(t.due_at)}</span></div>`}).join('');return `<div class="card"><h2 style="margin-top:0">${esc(s.full_name)}</h2><div class="progress"><span style="width:${pct}%"></span></div><p class="muted">${pct}% approved (${approved}/${assigns.length})</p>${rows||'<div class="muted">No tasks yet.</div>'}</div>`}).join('')||'<div class="empty">No student data.</div>'}</div>`;
  }

  function cohortsView(){return top('Academic Years','Keep FYP cohorts separate so future students can be added without mixing records.',`<button class="btn" id="newCohort">+ New Cohort</button>`)+`<div class="grid cols-3">${state.cohorts.map(c=>`<div class="card"><h3>${esc(c.label)}</h3><p class="muted">${c.is_active?'Active cohort':'Archived / inactive'}</p><span class="pill ${c.is_active?'ok':''}">${c.is_active?'Active':'Inactive'}</span></div>`).join('')||'<div class="empty">No cohorts yet.</div>'}</div>`;}

  function exportView(){
    const students=isAdmin()?state.students:(state.studentRecord?[state.studentRecord]:[]);
    return top('Export FYP Record','Generate a print/PDF-ready supervision record or CSV task history.')+`<div class="card"><div class="form-grid"><div class="field"><label>Student</label><select id="exportStudent">${students.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join('')}</select></div><div class="field"><label>Export type</label><select id="exportType"><option value="print">Supervision Record (Print / Save PDF)</option><option value="csv">Task & Submission History (CSV)</option></select></div></div><div class="actions"><button class="btn" id="doExport">Generate Export</button></div></div><div id="exportPreview" style="margin-top:18px"></div>`;
  }

  function bindViewActions(){
    const ns=q('#newStudent');if(ns)ns.onclick=openStudentModal; const nt=q('#newTask');if(nt)nt.onclick=openTaskModal; const nc=q('#newCohort');if(nc)nc.onclick=openCohortModal; const ms=q('#newMeetingSlot');if(ms)ms.onclick=openMeetingSlotModal; const em=q('#emailStudents');if(em)em.onclick=emailAllStudents;
    document.querySelectorAll('.openTask').forEach(b=>b.onclick=()=>openTaskSubmitModal(b.dataset.task,b.dataset.student));
    document.querySelectorAll('.reviewTask').forEach(b=>b.onclick=()=>openTaskReviewModal(b.dataset.task));
    document.querySelectorAll('.openSubmission').forEach(b=>b.onclick=()=>openSubmissionModal(b.dataset.id));
    document.querySelectorAll('.bookMeeting').forEach(b=>b.onclick=()=>bookMeeting(b.dataset.slot));
    const de=q('#doExport');if(de)de.onclick=runExport;
  }

  function modal(html){const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)d.remove();});return d;}
  function closeBtn(){return `<button type="button" class="btn secondary" data-close>Cancel</button>`;}

  function openCohortModal(){const m=modal(`<h2>New Academic Year</h2><form id="cohortForm" class="form-grid"><div class="field"><label>Label</label><input id="cLabel" placeholder="2026/2027" required></div><div class="field"><label>Start year</label><input id="cStart" type="number" min="2020" max="2100" value="${new Date().getFullYear()}" required></div><div class="actions field full">${closeBtn()}<button class="btn">Create</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#cohortForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('academic_years').insert({label:m.querySelector('#cLabel').value.trim(),start_year:+m.querySelector('#cStart').value,is_active:true});if(error)return alert(error.message);m.remove();await loadData();render();};}

  function openStudentModal(){if(!state.cohorts.length)return alert('Create an academic year first.');const m=modal(`<h2>Add FYP Student</h2><form id="studentForm" class="form-grid"><div class="field"><label>Full name</label><input id="sName" required></div><div class="field"><label>Email used for login</label><input id="sEmail" type="email" required></div><div class="field"><label>Student ID</label><input id="sNo"></div><div class="field"><label>Academic year</label><select id="sYear">${state.cohorts.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></div><div class="field full"><label>FYP project title</label><input id="pTitle" required></div><div class="field full"><label>Project description / objectives</label><textarea id="pDesc"></textarea></div><div class="actions field full">${closeBtn()}<button class="btn">Add Student</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#studentForm').onsubmit=async e=>{e.preventDefault();const payload={full_name:m.querySelector('#sName').value.trim(),email:m.querySelector('#sEmail').value.trim(),student_no:m.querySelector('#sNo').value.trim(),academic_year_id:m.querySelector('#sYear').value};const {data:stu,error}=await sb.from('students').insert(payload).select().single();if(error)return alert(error.message);const {error:pe}=await sb.from('projects').insert({student_id:stu.id,title:m.querySelector('#pTitle').value.trim(),description:m.querySelector('#pDesc').value.trim(),semester:1});if(pe)return alert(pe.message);m.remove();await loadData();render();};}

  function openTaskModal(){if(!state.students.length)return alert('Add students first.');const m=modal(`<h2>Create FYP Task</h2><form id="taskForm" class="form-grid"><div class="field full"><label>Task title</label><input id="tTitle" required></div><div class="field"><label>Research stage</label><select id="tStage"><option>Problem Definition</option><option>Literature Review</option><option>Methodology</option><option>Design</option><option>Development</option><option>Experiment</option><option>Results</option><option>Report Writing</option><option>Presentation</option><option>Publication</option></select></div><div class="field"><label>Semester</label><select id="tSem"><option value="1">Semester 1</option><option value="2">Semester 2</option></select></div><div class="field"><label>Open date/time</label><input id="tOpen" type="datetime-local"></div><div class="field"><label>Submission deadline</label><input id="tDue" type="datetime-local" required></div><div class="field full"><label>Instructions / expected output</label><textarea id="tInst" required></textarea></div><div class="field full"><label>Evidence requirements</label><textarea id="tEvidence" placeholder="e.g. literature matrix + 10 references + 1-page synthesis; or CAD screenshots + dimensions + design justification"></textarea></div><div class="field full"><label>Assign to</label><div>${state.students.map(s=>`<label style="display:inline-flex;gap:7px;margin:5px 14px 5px 0"><input type="checkbox" name="assignee" value="${s.id}"> ${esc(s.full_name)}</label>`).join('')}</div></div><div class="actions field full">${closeBtn()}<button class="btn">Publish Task</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#taskForm').onsubmit=async e=>{e.preventDefault();const ids=[...m.querySelectorAll('input[name=assignee]:checked')].map(x=>x.value);if(!ids.length)return alert('Select at least one student.');const {data:t,error}=await sb.from('tasks').insert({title:m.querySelector('#tTitle').value.trim(),stage:m.querySelector('#tStage').value,semester:+m.querySelector('#tSem').value,open_at:m.querySelector('#tOpen').value||null,due_at:m.querySelector('#tDue').value,instructions:m.querySelector('#tInst').value.trim(),evidence_requirements:m.querySelector('#tEvidence').value.trim(),created_by:state.user.id}).select().single();if(error)return alert(error.message);const {error:ae}=await sb.from('task_assignments').insert(ids.map(student_id=>({task_id:t.id,student_id})));if(ae)return alert(ae.message);m.remove();await loadData();render();};}

  function openTaskSubmitModal(taskId,studentId){const t=state.tasks.find(x=>x.id===taskId),old=latestSubmission(taskId,studentId);const m=modal(`<h2>${esc(t.title)}</h2><div class="notice"><b>Due:</b> ${fmt(t.due_at)}<br><b>Expected evidence:</b> ${esc(t.evidence_requirements||'Evidence supporting the completed work')}</div><p>${esc(t.instructions||'')}</p><form id="submitForm" class="form-grid"><div class="field full"><label>Work completed</label><textarea id="subSummary" required>${esc(old?.summary||'')}</textarea></div><div class="field full"><label>Results / findings</label><textarea id="subResults">${esc(old?.results||'')}</textarea></div><div class="field full"><label>What do these results mean?</label><textarea id="subMeaning">${esc(old?.interpretation||'')}</textarea></div><div class="field"><label>Problems encountered</label><textarea id="subProblems">${esc(old?.problems||'')}</textarea></div><div class="field"><label>Solution / next action</label><textarea id="subNext">${esc(old?.next_action||'')}</textarea></div><div class="field full"><label>Report section updated</label><input id="subReport" value="${esc(old?.report_section||'')}" placeholder="e.g. Chapter 2 Section 2.4"></div><div class="field full"><label>Evidence files</label><input id="subFiles" type="file" multiple><div class="help">Upload graphs, screenshots, PDFs, CAD images, code exports or other evidence.</div></div><div class="field full"><label>External evidence link (optional)</label><input id="subLink" type="url" value="${esc(old?.external_link||'')}" placeholder="https://github.com/... or Drive link"></div><div class="actions field full">${closeBtn()}<button class="btn">${old?'Submit Revision':'Submit Task'}</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#submitForm').onsubmit=async e=>{e.preventDefault();const data={task_id:taskId,student_id:studentId,summary:m.querySelector('#subSummary').value.trim(),results:m.querySelector('#subResults').value.trim(),interpretation:m.querySelector('#subMeaning').value.trim(),problems:m.querySelector('#subProblems').value.trim(),next_action:m.querySelector('#subNext').value.trim(),report_section:m.querySelector('#subReport').value.trim(),external_link:m.querySelector('#subLink').value.trim()||null,status:old?'resubmitted':'submitted',submitted_at:new Date().toISOString(),revision_no:(old?.revision_no||0)+1};
      let sub;if(old){const r=await sb.from('submissions').update(data).eq('id',old.id).select().single();if(r.error)return alert(r.error.message);sub=r.data;}else{const r=await sb.from('submissions').insert(data).select().single();if(r.error)return alert(r.error.message);sub=r.data;}
      const files=[...m.querySelector('#subFiles').files];for(const f of files){const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${studentId}/${taskId}/${sub.id}/${Date.now()}_${safe}`;const up=await sb.storage.from(cfg.evidenceBucket||'fyp-evidence').upload(path,f,{upsert:false});if(up.error)return alert('File upload failed: '+up.error.message);await sb.from('submission_files').insert({submission_id:sub.id,student_id:studentId,storage_path:path,file_name:f.name,file_type:f.type,file_size:f.size});}
      m.remove();await loadData();render();};}

  async function openSubmissionModal(id){const s=state.submissions.find(x=>x.id===id),t=state.tasks.find(x=>x.id===s.task_id),stu=state.students.find(x=>x.id===s.student_id);const {data:files}=await sb.from('submission_files').select('*').eq('submission_id',id).order('uploaded_at');const feedback=state.feedback.filter(f=>f.submission_id===id);let fileHtml='';for(const f of files||[]){const {data}=await sb.storage.from(cfg.evidenceBucket||'fyp-evidence').createSignedUrl(f.storage_path,3600);fileHtml+=`<div class="file-row"><span>${esc(f.file_name)}</span>${data?.signedUrl?`<a href="${data.signedUrl}" target="_blank" rel="noopener">Open</a>`:''}</div>`;}
    const m=modal(`<h2>${esc(t?.title||'Submission')}</h2><div class="notice"><b>${esc(stu?.full_name||'')}</b> · Submitted ${fmt(s.submitted_at)} · Revision ${s.revision_no||1}</div><div class="grid cols-2" style="margin-top:14px"><div class="card"><b>Work completed</b><p>${esc(s.summary||'—')}</p></div><div class="card"><b>Results / findings</b><p>${esc(s.results||'—')}</p></div><div class="card"><b>Interpretation</b><p>${esc(s.interpretation||'—')}</p></div><div class="card"><b>Problems / next action</b><p>${esc(s.problems||'—')}<br>${esc(s.next_action||'')}</p></div></div><h3>Evidence</h3>${fileHtml||'<div class="muted">No uploaded files.</div>'}${s.external_link?`<p><a href="${esc(s.external_link)}" target="_blank" rel="noopener">External evidence link</a></p>`:''}<h3>Feedback history</h3>${feedback.map(f=>`<div class="log-entry"><strong>${esc(f.decision)}</strong><div>${esc(f.comment||'')}</div><span class="tiny muted">${fmt(f.created_at)}</span></div>`).join('')||'<div class="muted">No feedback yet.</div>'}${isAdmin()?`<form id="reviewForm" class="form-grid" style="margin-top:18px"><div class="field"><label>Decision</label><select id="decision"><option value="approved">Approve</option><option value="revision_required">Revision Required</option><option value="incomplete">Incomplete</option></select></div><div class="field"><label>Revision due (optional)</label><input id="revDue" type="datetime-local"></div><div class="field full"><label>Admin feedback</label><textarea id="comment" required></textarea></div><div class="actions field full">${closeBtn()}<button class="btn">Save Review</button></div></form>`:`<div class="actions">${closeBtn()}</div>`}`);
    m.querySelector('[data-close]').onclick=()=>m.remove();const rf=m.querySelector('#reviewForm');if(rf)rf.onsubmit=async e=>{e.preventDefault();const decision=m.querySelector('#decision').value,comment=m.querySelector('#comment').value.trim(),revision_due_at=m.querySelector('#revDue').value||null;const r=await sb.from('feedback').insert({submission_id:id,supervisor_id:state.user.id,decision,comment,revision_due_at});if(r.error)return alert(r.error.message);const u=await sb.from('submissions').update({status:decision}).eq('id',id);if(u.error)return alert(u.error.message);m.remove();await loadData();render();};
  }

  function openTaskReviewModal(taskId){const t=state.tasks.find(x=>x.id===taskId),ass=state.assignments.filter(a=>a.task_id===taskId);const rows=ass.map(a=>{const stu=state.students.find(s=>s.id===a.student_id),sub=latestSubmission(taskId,a.student_id),[lab,cl]=assignmentStatus(t,a.student_id);return `<tr><td>${esc(stu?.full_name||'')}</td><td><span class="pill ${cl}">${lab}</span></td><td>${sub?fmt(sub.submitted_at):'—'}</td><td>${sub?`<button class="btn secondary small openSubInside" data-id="${sub.id}">Open</button>`:'—'}</td></tr>`}).join('');const m=modal(`<h2>${esc(t.title)}</h2><p>${esc(t.instructions||'')}</p><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="actions">${closeBtn()}</div>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelectorAll('.openSubInside').forEach(b=>b.onclick=()=>{m.remove();openSubmissionModal(b.dataset.id);});}

  function runExport(){const studentId=q('#exportStudent').value,type=q('#exportType').value,stu=state.students.find(s=>s.id===studentId),p=projectForStudent(studentId),ass=state.assignments.filter(a=>a.student_id===studentId),rows=ass.map(a=>{const t=state.tasks.find(x=>x.id===a.task_id),s=latestSubmission(a.task_id,studentId);return {task:t?.title||'',stage:t?.stage||'',due:t?.due_at||'',submitted:s?.submitted_at||'',status:s?.status||'pending',summary:s?.summary||'',results:s?.results||'',interpretation:s?.interpretation||'',report:s?.report_section||''};});
    if(type==='csv'){const headers=Object.keys(rows[0]||{task:'',stage:'',due:'',submitted:'',status:'',summary:'',results:'',interpretation:'',report:''});const csv=[headers.join(','),...rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`FYP_${(stu?.full_name||'student').replace(/\s+/g,'_')}_record.csv`;a.click();URL.revokeObjectURL(url);return;}
    const meetings=state.meetingBookings.filter(b=>b.student_id===studentId).map(b=>state.meetingSlots.find(sl=>sl.id===b.slot_id)).filter(Boolean);
    q('#exportPreview').innerHTML=`<div class="card" id="printRecord"><div class="print-title"><h1>FYP Supervision Record</h1></div><h2>${esc(stu?.full_name||'')}</h2><p><b>Project:</b> ${esc(p?.title||'')}</p><p><b>Academic year:</b> ${esc(state.cohorts.find(c=>c.id===stu?.academic_year_id)?.label||'')}</p><hr><h3>Supervision meetings booked</h3>${meetings.map(m=>`<div class="log-entry"><strong>${fmt(m.start_at)}</strong><div class="tiny muted">${esc(m.location||'')} ${m.note?`· ${esc(m.note)}`:''}</div></div>`).join('')||'<p>No meeting bookings recorded.</p>'}<hr><h3>Task and supervision history</h3>${rows.map(r=>`<div class="log-entry"><strong>${esc(r.task)}</strong><div class="tiny muted">${esc(r.stage)} · Due ${fmt(r.due)} · Submitted ${fmt(r.submitted)} · ${esc(r.status)}</div>${r.summary?`<p><b>Work:</b> ${esc(r.summary)}</p>`:''}${r.results?`<p><b>Results:</b> ${esc(r.results)}</p>`:''}${r.interpretation?`<p><b>Interpretation:</b> ${esc(r.interpretation)}</p>`:''}${r.report?`<p><b>Report section:</b> ${esc(r.report)}</p>`:''}</div>`).join('')||'<p>No task history.</p>'}</div><div class="actions no-print"><button class="btn" id="printNow">Print / Save PDF</button></div>`;q('#printNow').onclick=()=>window.print();
  }

  init();
})();
