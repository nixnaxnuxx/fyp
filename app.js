(() => {
  const cfg = window.FYP_CONFIG || {};
  const app = document.getElementById('app');
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseUrl.includes('YOUR_PROJECT')) {
    app.innerHTML = `<div class="auth"><div class="card"><h2>Configuration needed</h2><p>Copy <b>config.example.js</b> to <b>config.js</b>, then add your Supabase project URL and anon/publishable key.</p></div></div>`;
    return;
  }
  const cleanSupabaseUrl = String(cfg.supabaseUrl).trim().replace(/\/+$/, '');
  const sb = window.supabase.createClient(cleanSupabaseUrl, cfg.supabaseAnonKey);
  const state = { user:null, profile:null, view:'dashboard', cohorts:[], students:[], projects:[], tasks:[], assignments:[], submissions:[], feedback:[], meetingSlots:[], meetingBookings:[], meetingRecords:[], meetingFollowups:[], files:[], studentRecord:null };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const BRUNEI_TZ = 'Asia/Brunei';
  const fmt = d => d ? new Intl.DateTimeFormat('en-BN', {timeZone:BRUNEI_TZ,dateStyle:'medium',timeStyle:'short'}).format(new Date(d)) : '—';
  const dateOnly = d => d ? new Intl.DateTimeFormat('en-BN', {timeZone:BRUNEI_TZ,dateStyle:'medium'}).format(new Date(d)) : '—';
  const timeOnly = d => d ? new Intl.DateTimeFormat('en-BN', {timeZone:BRUNEI_TZ,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(d)) : '—';
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
      sb.from('meeting_bookings').select('*').order('booked_at',{ascending:false}),
      sb.from('meeting_records').select('*').order('updated_at',{ascending:false}),
      sb.from('meeting_followups').select('*').order('due_at',{ascending:true})
    ];
    const [coh,stu,pro,tas,ass,sub,fee,slots,books,recs,fups] = await Promise.all(fetches);
    state.cohorts=coh.data||[]; state.students=stu.data||[]; state.projects=pro.data||[]; state.tasks=tas.data||[]; state.assignments=ass.data||[]; state.submissions=sub.data||[]; state.feedback=fee.data||[]; state.meetingSlots=slots.data||[]; state.meetingBookings=books.data||[]; state.meetingRecords=recs.data||[]; state.meetingFollowups=fups.data||[];
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
    const items = isAdmin() ? [['dashboard','◫  Dashboard'],['students','◎  Students'],['tasks','✓  Tasks'],['meetings','◷  Meetings'],['submissions','⇧  Submissions'],['progress','↗  Progress'],['cohorts','▦  Cohorts'],['export','↓  Export']] : [['dashboard','◫  My FYP'],['tasks','✓  My Tasks'],['meetings','◷  Book Meeting'],['submissions','⇧  My Submissions'],['progress','↗  Progress'],['export','↓  Export Record']];
    return `<div class="nav">${items.map(([v,l])=>`<button data-view="${v}" class="${state.view===v?'active':''}">${l}</button>`).join('')}</div>`;
  }
  function render(){
    app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">FYP Portal<small>Supervision Management System</small></div>${nav()}<div class="account"><div>${esc(state.profile?.full_name||state.user.email)}</div><div class="tiny">${esc(roleLabel())}</div><div class="version-badge">Portal v6.7</div><button id="signout" class="btn secondary small" style="margin-top:10px">Sign out</button></div></aside><main class="main"><div id="view"></div></main></div>`;
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
    return top('FYP Admin Dashboard',currentCohort?`Current cohort: ${esc(currentCohort.label)}`:'Create your first academic year to begin.',`<button class="btn" id="newTask">+ New Task</button>`)+`<div class="hero-strip"><div><h2>Keep every FYP moving, week by week.</h2><p>Track evidence, deadlines, submissions, supervision meetings and approvals from one workspace. Use the dashboard to catch delays before they become end-of-semester problems.</p></div><div class="hero-badge">${state.students.length} active student${state.students.length===1?'':'s'}</div></div>`+
      `<div class="grid cols-4"><div class="card kpi"><div class="label">Students</div><div class="value">${state.students.length}</div><div class="hint">Across visible cohorts</div></div><div class="card kpi"><div class="label">Pending review</div><div class="value">${pendingReview}</div><div class="hint">Submitted work awaiting you</div></div><div class="card kpi"><div class="label">Overdue</div><div class="value">${overdue}</div><div class="hint">No submission after deadline</div></div><div class="card kpi"><div class="label">Approved</div><div class="value">${approved}</div><div class="hint">Approved task submissions</div></div></div>`+
      `<div class="section-title"><h2>Student overview</h2><button class="btn secondary small" id="newStudent">+ Add Student</button></div>`+
      studentOverviewTable();
  }

  function studentOverviewTable(showActions=false){
    if(!state.students.length)return `<div class="empty">No students yet.</div>`;
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Project</th><th>Cohort</th><th>Tasks</th><th>Progress</th><th>Status</th>${showActions?'<th>Actions</th>':''}</tr></thead><tbody>${state.students.map(s=>{const p=projectForStudent(s.id);const assigns=state.assignments.filter(a=>a.student_id===s.id);const app=assigns.filter(a=>{const sub=latestSubmission(a.task_id,s.id);return sub?.status==='approved'}).length;const pct=assigns.length?Math.round(app/assigns.length*100):0;const hasOverdue=assigns.some(a=>{const t=state.tasks.find(x=>x.id===a.task_id);return t&&!latestSubmission(t.id,s.id)&&t.due_at&&new Date(t.due_at)<now()});return `<tr><td><b>${esc(s.full_name)}</b><div class="tiny muted">${esc(s.email||'')}</div></td><td>${esc(p?.title||'—')}</td><td>${esc(state.cohorts.find(c=>c.id===s.academic_year_id)?.label||'—')}</td><td>${app}/${assigns.length} approved</td><td><div class="progress"><span style="width:${pct}%"></span></div><div class="tiny muted">${pct}%</div></td><td><span class="pill ${hasOverdue?'bad':'ok'}">${hasOverdue?'Needs attention':'On track'}</span></td>${showActions?`<td><button class="btn danger small deleteStudent" data-student="${s.id}">Delete</button></td>`:''}</tr>`}).join('')}</tbody></table></div>`;
  }

  function studentDashboard(){
    const s=state.studentRecord;if(!s)return top('My FYP','Your account is not linked to a student record yet.')+`<div class="notice bad">Ask your FYP administrator to add your exact sign-in email to the student list.</div>`;
    const p=projectForStudent(s.id), assigns=state.assignments.filter(a=>a.student_id===s.id).map(a=>state.tasks.find(t=>t.id===a.task_id)).filter(Boolean).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
    const pending=assigns.filter(t=>!latestSubmission(t.id,s.id));const next=pending[0];const approved=assigns.filter(t=>latestSubmission(t.id,s.id)?.status==='approved').length;const pct=assigns.length?Math.round(approved/assigns.length*100):0;
    return top('My FYP',esc(p?.title||'FYP project'))+`<div class="hero-strip"><div><h2>Your research workspace</h2><p>Complete each task with evidence, keep your report updated, and use feedback to improve the next revision.</p></div><div class="hero-badge">${pct}% approved</div></div><div class="grid cols-3"><div class="card kpi"><div class="label">Overall approved</div><div class="value">${pct}%</div></div><div class="card kpi"><div class="label">Tasks approved</div><div class="value">${approved}/${assigns.length}</div></div><div class="card kpi"><div class="label">Next deadline</div><div class="value" style="font-size:20px">${next?dateOnly(next.due_at):'None'}</div></div></div>`+
      `<div class="section-title"><h2>Next task</h2></div>${next?taskCard(next,s.id,true):`<div class="empty">No upcoming task.</div>`}`+
      `${followupsForStudent(s.id).filter(f=>f.status!=='done').length?`<div class="section-title"><h2>Supervisor follow-ups</h2></div><div class="followup-list">${followupsForStudent(s.id).filter(f=>f.status!=='done').slice(0,5).map(f=>`<div class="followup-item"><div><strong>${esc(f.title)}</strong>${f.details?`<div class="muted">${esc(f.details)}</div>`:''}<div class="tiny muted">${f.due_at?`Due ${fmt(f.due_at)}`:'For next supervision'}</div></div><span class="pill warn">${esc(f.status)}</span></div>`).join('')}</div>`:''}`+
      `<div class="section-title"><h2>Recent tasks</h2></div><div class="grid cols-2">${assigns.slice(0,6).map(t=>taskCard(t,s.id,true)).join('')||'<div class="empty">No tasks assigned yet.</div>'}</div>`;
  }

  function taskCard(t,studentId,studentMode=false){const [label,cls]=assignmentStatus(t,studentId);const sub=latestSubmission(t.id,studentId);return `<div class="card task-card"><div><h3>${esc(t.title)}</h3><p>${esc((t.instructions||'').slice(0,180))}</p><div class="task-meta"><span class="pill accent">${esc(t.stage||'General')}</span><span class="pill">Due ${fmt(t.due_at)}</span><span class="pill ${cls}">${label}</span></div></div>${studentMode?`<button class="btn small openTask" data-task="${t.id}" data-student="${studentId}">${sub?'View / Revise':'Open'}</button>`:''}</div>`;}

  function studentsView(){return top('Students','Add students now and continue adding new cohorts in future years.',`<button class="btn" id="newStudent">+ Add Student</button>`)+studentOverviewTable(true);}

  function tasksSupervisor(){
    return top('Tasks','Create your own FYP tasks, assign them to selected students, and edit or reuse them anytime.',`<button class="btn" id="newTask">+ New Task</button>`)+`<div class="grid cols-2">${state.tasks.map(t=>{const ass=state.assignments.filter(a=>a.task_id===t.id);const priority=t.priority||'normal';return `<div class="card task-admin-card"><div class="task-card"><div><div class="task-title-row"><h3>${esc(t.title)}</h3><span class="pill priority-${esc(priority)}">${esc(priority.charAt(0).toUpperCase()+priority.slice(1))}</span></div><p>${esc(t.instructions||'')}</p>${t.expected_output?`<div class="task-output"><b>Expected output:</b> ${esc(t.expected_output)}</div>`:''}<div class="task-meta"><span class="pill accent">${esc(t.stage||'General')}</span><span class="pill">Semester ${esc(t.semester||1)}</span><span class="pill">Due ${fmt(t.due_at)}</span><span class="pill">${ass.length} student${ass.length===1?'':'s'}</span></div></div></div><div class="task-actions"><button class="btn secondary small reviewTask" data-task="${t.id}">Review</button><button class="btn secondary small editTask" data-task="${t.id}">Edit</button><button class="btn ghost small duplicateTask" data-task="${t.id}">Duplicate</button><button class="btn danger small deleteTask" data-task="${t.id}">Delete</button></div></div>`}).join('')||'<div class="empty">No tasks created yet. Click + New Task and enter the work you want your students to complete.</div>'}</div>`;
  }
  function tasksStudent(){const s=state.studentRecord;if(!s)return top('My Tasks','Student record not linked.');const tasks=state.assignments.filter(a=>a.student_id===s.id).map(a=>state.tasks.find(t=>t.id===a.task_id)).filter(Boolean);return top('My Tasks','Complete each task and attach evidence before the deadline.')+`<div class="grid cols-2">${tasks.map(t=>taskCard(t,s.id,true)).join('')||'<div class="empty">No tasks assigned.</div>'}</div>`;}

  async function deleteTask(taskId){
    const task=state.tasks.find(t=>t.id===taskId);if(!task)return;
    const assigned=state.assignments.filter(a=>a.task_id===taskId).length;
    const subs=state.submissions.filter(s=>s.task_id===taskId);
    const msg=`Delete task "${task.title}"?\n\nThis will remove the task from ${assigned} assigned student${assigned===1?'':'s'} and delete ${subs.length} linked submission record${subs.length===1?'':'s'}, feedback, and submission metadata. This cannot be undone.`;
    if(!confirm(msg))return;
    const typed=prompt('Type DELETE TASK to confirm permanent deletion:');
    if(typed!=='DELETE TASK')return alert('Task deletion cancelled.');

    // Remove uploaded evidence objects first so task deletion does not leave orphaned files in Storage.
    const subIds=subs.map(x=>x.id);
    if(subIds.length){
      const {data:fileRows,error:fileErr}=await sb.from('submission_files').select('storage_path').in('submission_id',subIds);
      if(fileErr)return alert('Could not check evidence files: '+fileErr.message);
      const paths=(fileRows||[]).map(f=>f.storage_path).filter(Boolean);
      if(paths.length){
        const rm=await sb.storage.from(cfg.evidenceBucket||'fyp-evidence').remove(paths);
        if(rm.error)return alert('Could not remove task evidence files: '+rm.error.message);
      }
    }

    const r=await sb.from('tasks').delete().eq('id',taskId);
    if(r.error)return alert(r.error.message);
    await loadData();render();
  }


  function bookingForSlot(slotId){return state.meetingBookings.find(b=>b.slot_id===slotId);}
  function meetingStatus(slot){const b=bookingForSlot(slot.id);if(b)return ['Booked','ok'];if(new Date(slot.end_at)<now())return ['Past',''];return ['Available','accent'];}
  function meetingRecordForBooking(bookingId){return state.meetingRecords.find(r=>r.booking_id===bookingId);}
  function followupsForStudent(studentId){return state.meetingFollowups.filter(f=>f.student_id===studentId);}
  function followupsForBooking(bookingId){return state.meetingFollowups.filter(f=>f.booking_id===bookingId);}

  function meetingsView(){
    if(isAdmin()){
      const rows=state.meetingSlots.map(slot=>{const b=bookingForSlot(slot.id),stu=b?state.students.find(s=>s.id===b.student_id):null,[lab,cl]=meetingStatus(slot),rec=b?meetingRecordForBooking(b.id):null,openF=b?followupsForBooking(b.id).filter(f=>f.status!=='done').length:0;return `<tr><td>${fmt(slot.start_at)}</td><td>${fmt(slot.end_at)}</td><td>${esc(slot.location||'')}</td><td><span class="pill ${cl}">${lab}</span><button class="inline-edit editMeetingSlot" data-slot="${slot.id}" title="Edit this meeting slot">✎ Edit</button></td><td>${b?`${esc(stu?.full_name||'')}<div class="tiny muted">${esc(projectForStudent(stu?.id)?.title||'')}</div>`:'—'}</td><td><div class="meeting-actions"><button class="btn secondary small editMeetingSlot" data-slot="${slot.id}">Edit</button><button class="btn danger small deleteMeetingSlot" data-slot="${slot.id}">Delete</button>${b?`<button class="btn ${rec?'secondary':''} small recordMeeting" data-booking="${b.id}">${rec?'View / Update Notes':'Record Meeting'}</button>${openF?`<div class="tiny muted" style="margin-top:6px">${openF} follow-up${openF===1?'':'s'} open</div>`:''}`:''}</div></td></tr>`}).join('');
      return top('FYP Supervision Meetings','Set availability, edit meeting details, record what was discussed, and assign actions for the next supervision meeting.',`<div class="top-actions"><button class="btn secondary" id="emailStudents">Email All Students</button><button class="btn" id="newMeetingSlot">+ Add Availability</button></div>`)+
      `<div class="card"><h3 style="margin-top:0">Student & project list</h3>${studentProjectList()}</div><div class="section-title"><h2>Availability, bookings & supervision notes</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Start</th><th>End</th><th>Location / Mode</th><th>Status</th><th>Booked by</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="muted">No availability slots yet. Add the times you are free this week.</td></tr>'}</tbody></table></div>`;
    }
    const stu=state.studentRecord;if(!stu)return top('Book Supervision Meeting','Your student record is not linked yet.');
    const myBooking=state.meetingBookings.find(b=>b.student_id===stu.id && new Date(state.meetingSlots.find(s=>s.id===b.slot_id)?.end_at||0)>=now());
    const available=state.meetingSlots.filter(slot=>!bookingForSlot(slot.id)&&new Date(slot.start_at)>now());
    const followups=followupsForStudent(stu.id).filter(f=>f.status!=='done');
    const recentRecords=state.meetingBookings.filter(b=>b.student_id===stu.id).map(b=>({b,slot:state.meetingSlots.find(sl=>sl.id===b.slot_id),rec:meetingRecordForBooking(b.id)})).filter(x=>x.rec).sort((a,b)=>new Date(b.slot?.start_at||0)-new Date(a.slot?.start_at||0)).slice(0,3);
    return top('Book Supervision Meeting','Choose one available slot and keep track of the actions agreed during supervision.')+
      `${myBooking?(()=>{const sl=state.meetingSlots.find(s=>s.id===myBooking.slot_id);return `<div class="notice ok"><b>Your upcoming meeting is booked:</b> ${fmt(sl?.start_at)} – ${fmt(sl?.end_at)}${sl?.location?` · ${esc(sl.location)}`:''}</div>`})():''}`+
      `${followups.length?`<div class="section-title"><h2>Before your next meeting</h2></div><div class="followup-list">${followups.map(f=>`<div class="followup-item"><div><strong>${esc(f.title)}</strong>${f.details?`<div class="muted">${esc(f.details)}</div>`:''}<div class="tiny muted">${f.due_at?`Due ${fmt(f.due_at)}`:'No due date set'}</div></div><span class="pill warn">${esc(f.status)}</span></div>`).join('')}</div>`:''}`+
      `<div class="section-title"><h2>Available slots</h2></div><div class="grid cols-2">${available.map(slot=>`<div class="card"><h3>${dateOnly(slot.start_at)}</h3><p><b>${timeOnly(slot.start_at)} – ${timeOnly(slot.end_at)}</b></p><p class="muted">${esc(slot.location||'FYP supervision meeting')}</p><button class="btn bookMeeting" data-slot="${slot.id}">Book this slot</button></div>`).join('')||'<div class="empty">No available meeting slots at the moment.</div>'}</div>`+
      `${recentRecords.length?`<div class="section-title"><h2>Recent supervision notes</h2></div>${recentRecords.map(x=>`<div class="card meeting-note-card"><div class="tiny muted">${fmt(x.slot?.start_at)}</div><h3>${esc(x.rec.summary||'Supervision meeting')}</h3>${x.rec.comments?`<p><b>Supervisor comments:</b> ${esc(x.rec.comments)}</p>`:''}${x.rec.decisions?`<p><b>Decisions:</b> ${esc(x.rec.decisions)}</p>`:''}</div>`).join('')}`:''}`;
  }

  function studentProjectList(){
    if(!state.students.length)return '<div class="muted">No students have been added yet.</div>';
    return `<div class="project-list">${state.students.map(s=>`<div class="project-person"><div><strong>${esc(s.full_name)}</strong><div class="tiny muted">${esc(s.email||'')}</div></div><div>${esc(projectForStudent(s.id)?.title||'Project not assigned')}</div></div>`).join('')}</div>`;
  }

  function openMeetingSlotModal(slotId=null){
    const slot=slotId?state.meetingSlots.find(s=>s.id===slotId):null, booked=slot?bookingForSlot(slot.id):null;
    const m=modal(`<h2>${slot?'Edit Supervision Meeting':'Add Supervision Availability'}</h2>${booked?`<div class="notice warn"><b>This slot is already booked.</b> Changes to the date, time, location or note will affect ${esc(state.students.find(s=>s.id===booked.student_id)?.full_name||'the student')}'s booking.</div>`:''}<form id="slotForm" class="form-grid"><div class="field"><label>Start</label><input id="slotStart" type="datetime-local" value="${toLocalInput(slot?.start_at)}" required></div><div class="field"><label>End</label><input id="slotEnd" type="datetime-local" value="${toLocalInput(slot?.end_at)}" required></div><div class="field full"><label>Location / meeting mode</label><input id="slotLocation" value="${esc(slot?.location||'')}" placeholder="e.g. Office, FIT Meeting Room, Microsoft Teams"></div><div class="field full"><label>Note for students (optional)</label><textarea id="slotNote" placeholder="e.g. Bring your latest report draft and evidence of this week’s work.">${esc(slot?.note||'')}</textarea></div><div class="actions field full">${closeBtn()}<button class="btn">${slot?'Save Changes':'Publish Slot'}</button></div></form>`);
    m.querySelector('[data-close]').onclick=()=>m.remove();
    m.querySelector('#slotForm').onsubmit=async e=>{e.preventDefault();const start=m.querySelector('#slotStart').value,end=m.querySelector('#slotEnd').value;if(new Date(end)<=new Date(start))return alert('End time must be after start time.');const payload={start_at:localInputToIso(start),end_at:localInputToIso(end),location:m.querySelector('#slotLocation').value.trim(),note:m.querySelector('#slotNote').value.trim()};const r=slot?await sb.from('meeting_slots').update(payload).eq('id',slot.id):await sb.from('meeting_slots').insert({...payload,created_by:state.user.id});if(r.error)return alert(r.error.message);m.remove();await loadData();render();};
  }

  async function deleteMeetingSlot(slotId){
    const slot=state.meetingSlots.find(s=>s.id===slotId);if(!slot)return;
    const booking=bookingForSlot(slotId);
    const stu=booking?state.students.find(s=>s.id===booking.student_id):null;
    if(booking){
      const rec=meetingRecordForBooking(booking.id);
      const fups=followupsForBooking(booking.id);
      const details=[
        `Meeting: ${fmt(slot.start_at)} – ${fmt(slot.end_at)}`,
        `Booked by: ${stu?.full_name||'Student'}`,
        rec?'Supervision record: will be deleted':'Supervision record: none',
        `Follow-up actions: ${fups.length} will be deleted`
      ].join('\n');
      if(!confirm(`This meeting has already been booked.\n\n${details}\n\nDeleting the meeting will cancel the student's booking and permanently remove any linked supervision record and follow-up actions. Continue?`))return;
      const typed=prompt(`For safety, type DELETE MEETING to permanently delete this booked meeting for ${stu?.full_name||'the student'}.`);
      if(typed!=='DELETE MEETING')return alert('Meeting deletion cancelled.');
    }else{
      if(!confirm(`Delete the available meeting slot on ${fmt(slot.start_at)}?`))return;
    }
    const r=await sb.from('meeting_slots').delete().eq('id',slotId);
    if(r.error)return alert(r.error.message);
    await loadData();render();
  }

  async function deleteStudent(studentId){
    const stu=state.students.find(s=>s.id===studentId);if(!stu)return;
    const project=projectForStudent(studentId);
    const first=confirm(`Delete ${stu.full_name} from the FYP portal?\n\nThis permanently removes the student's linked project, task assignments, submissions, meeting bookings, supervision records and follow-up actions. Shared task definitions remain.`);
    if(!first)return;
    const typed=prompt(`For safety, type DELETE to permanently remove ${stu.full_name}.`);
    if(typed!=='DELETE')return alert('Deletion cancelled.');
    const r=await sb.from('students').delete().eq('id',studentId);
    if(r.error)return alert('Could not delete student: '+r.error.message);
    alert(`${stu.full_name} has been removed from the portal.${project?' Their linked project and supervision records were removed as well.':''}\n\nIf they previously created a login account, the Supabase Auth login itself is not deleted by this portal.`);
    await loadData();render();
  }

  function openMeetingRecordModal(bookingId){
    const booking=state.meetingBookings.find(b=>b.id===bookingId),stu=state.students.find(s=>s.id===booking?.student_id),slot=state.meetingSlots.find(s=>s.id===booking?.slot_id),old=meetingRecordForBooking(bookingId),followups=followupsForBooking(bookingId);
    if(!booking||!stu)return alert('Meeting booking not found.');
    const followupRows=followups.map(f=>`<div class="followup-edit-row"><div><strong>${esc(f.title)}</strong>${f.details?`<div class="tiny muted">${esc(f.details)}</div>`:''}<div class="tiny muted">${f.due_at?`Due ${fmt(f.due_at)}`:'No due date'}</div></div><button type="button" class="btn secondary small toggleFollowup" data-id="${f.id}" data-status="${f.status}">${f.status==='done'?'Reopen':'Mark done'}</button></div>`).join('');
    const m=modal(`<h2>Supervision Record</h2><div class="notice"><b>${esc(stu.full_name)}</b><br>${esc(projectForStudent(stu.id)?.title||'FYP project')}<br>${fmt(slot?.start_at)}${slot?.location?` · ${esc(slot.location)}`:''}</div><form id="meetingRecordForm" class="form-grid" style="margin-top:16px"><div class="field full"><label>Meeting summary</label><input id="mrSummary" value="${esc(old?.summary||'')}" placeholder="e.g. Reviewed literature matrix and agreed methodology direction"></div><div class="field full"><label>Supervisor comments / feedback</label><textarea id="mrComments" placeholder="What did you observe? What needs improvement?">${esc(old?.comments||'')}</textarea></div><div class="field full"><label>Key decisions / agreements</label><textarea id="mrDecisions" placeholder="e.g. Use object detection instead of classification; reduce scope to four classes">${esc(old?.decisions||'')}</textarea></div><div class="field full"><label>Student progress / concerns</label><textarea id="mrProgress" placeholder="e.g. Technical work on track, report writing behind">${esc(old?.progress_note||'')}</textarea></div><div class="field full"><label>Focus for next meeting</label><textarea id="mrNextFocus" placeholder="What should be ready or discussed next time?">${esc(old?.next_meeting_focus||'')}</textarea></div><div class="field full"><label>Existing follow-up tasks</label>${followupRows||'<div class="muted">No follow-up tasks yet.</div>'}</div><div class="field full"><label>Add task for next meeting</label><input id="fuTitle" placeholder="e.g. Complete AI baseline evaluation"></div><div class="field full"><label>Task details / expected evidence</label><textarea id="fuDetails" placeholder="e.g. Run 20 trials per gesture and bring confusion matrix + failure analysis"></textarea></div><div class="field"><label>Due date/time</label><input id="fuDue" type="datetime-local"></div><div class="field"><label>Status</label><select id="fuStatus"><option value="pending">Pending</option><option value="in_progress">In progress</option></select></div><div class="actions field full">${closeBtn()}<button class="btn">Save Supervision Record</button></div></form>`);
    m.querySelector('[data-close]').onclick=()=>m.remove();
    m.querySelectorAll('.toggleFollowup').forEach(b=>b.onclick=async()=>{const status=b.dataset.status==='done'?'pending':'done';const r=await sb.from('meeting_followups').update({status,completed_at:status==='done'?new Date().toISOString():null}).eq('id',b.dataset.id);if(r.error)return alert(r.error.message);await loadData();m.remove();openMeetingRecordModal(bookingId);});
    m.querySelector('#meetingRecordForm').onsubmit=async e=>{e.preventDefault();const record={booking_id:bookingId,student_id:stu.id,summary:m.querySelector('#mrSummary').value.trim(),comments:m.querySelector('#mrComments').value.trim(),decisions:m.querySelector('#mrDecisions').value.trim(),progress_note:m.querySelector('#mrProgress').value.trim(),next_meeting_focus:m.querySelector('#mrNextFocus').value.trim(),updated_by:state.user.id,updated_at:new Date().toISOString()};let rr;if(old)rr=await sb.from('meeting_records').update(record).eq('id',old.id);else rr=await sb.from('meeting_records').insert({...record,created_by:state.user.id});if(rr.error)return alert(rr.error.message);const title=m.querySelector('#fuTitle').value.trim();if(title){const fr=await sb.from('meeting_followups').insert({booking_id:bookingId,student_id:stu.id,title,details:m.querySelector('#fuDetails').value.trim(),due_at:localInputToIso(m.querySelector('#fuDue').value),status:m.querySelector('#fuStatus').value,created_by:state.user.id});if(fr.error)return alert(fr.error.message);}m.remove();await loadData();render();};
  }

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
    const slotLines=available.length?available.map(sl=>`- ${fmt(sl.start_at)} to ${timeOnly(sl.end_at)}${sl.location?` (${sl.location})`:''}`).join('\n'):'Please check the portal for the latest available slots.';
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
    const ns=q('#newStudent');if(ns)ns.onclick=openStudentModal; const nt=q('#newTask');if(nt)nt.onclick=openTaskModal; const nc=q('#newCohort');if(nc)nc.onclick=openCohortModal; const ms=q('#newMeetingSlot');if(ms)ms.onclick=()=>openMeetingSlotModal(); const em=q('#emailStudents');if(em)em.onclick=emailAllStudents;
    document.querySelectorAll('.editMeetingSlot').forEach(b=>b.onclick=()=>openMeetingSlotModal(b.dataset.slot));
    document.querySelectorAll('.deleteMeetingSlot').forEach(b=>b.onclick=()=>deleteMeetingSlot(b.dataset.slot));
    document.querySelectorAll('.deleteStudent').forEach(b=>b.onclick=()=>deleteStudent(b.dataset.student));
    document.querySelectorAll('.openTask').forEach(b=>b.onclick=()=>openTaskSubmitModal(b.dataset.task,b.dataset.student));
    document.querySelectorAll('.reviewTask').forEach(b=>b.onclick=()=>openTaskReviewModal(b.dataset.task));
    document.querySelectorAll('.editTask').forEach(b=>b.onclick=()=>openTaskModal(b.dataset.task,false));
    document.querySelectorAll('.duplicateTask').forEach(b=>b.onclick=()=>openTaskModal(b.dataset.task,true));
    document.querySelectorAll('.deleteTask').forEach(b=>b.onclick=()=>deleteTask(b.dataset.task));
    document.querySelectorAll('.openSubmission').forEach(b=>b.onclick=()=>openSubmissionModal(b.dataset.id));
    document.querySelectorAll('.bookMeeting').forEach(b=>b.onclick=()=>bookMeeting(b.dataset.slot)); document.querySelectorAll('.recordMeeting').forEach(b=>b.onclick=()=>openMeetingRecordModal(b.dataset.booking));
    const de=q('#doExport');if(de)de.onclick=runExport;
  }

  function modal(html){const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)d.remove();});return d;}
  function closeBtn(){return `<button type="button" class="btn secondary" data-close>Cancel</button>`;}

  function openCohortModal(){const m=modal(`<h2>New Academic Year</h2><form id="cohortForm" class="form-grid"><div class="field"><label>Label</label><input id="cLabel" placeholder="2026/2027" required></div><div class="field"><label>Start year</label><input id="cStart" type="number" min="2020" max="2100" value="${new Date().getFullYear()}" required></div><div class="actions field full">${closeBtn()}<button class="btn">Create</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#cohortForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('academic_years').insert({label:m.querySelector('#cLabel').value.trim(),start_year:+m.querySelector('#cStart').value,is_active:true});if(error)return alert(error.message);m.remove();await loadData();render();};}

  function openStudentModal(){if(!state.cohorts.length)return alert('Create an academic year first.');const m=modal(`<h2>Add FYP Student</h2><form id="studentForm" class="form-grid"><div class="field"><label>Full name</label><input id="sName" required></div><div class="field"><label>Email used for login</label><input id="sEmail" type="email" required></div><div class="field"><label>Student ID</label><input id="sNo"></div><div class="field"><label>Academic year</label><select id="sYear">${state.cohorts.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></div><div class="field full"><label>FYP project title</label><input id="pTitle" required></div><div class="field full"><label>Project description / objectives</label><textarea id="pDesc"></textarea></div><div class="actions field full">${closeBtn()}<button class="btn">Add Student</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#studentForm').onsubmit=async e=>{e.preventDefault();const payload={full_name:m.querySelector('#sName').value.trim(),email:m.querySelector('#sEmail').value.trim(),student_no:m.querySelector('#sNo').value.trim(),academic_year_id:m.querySelector('#sYear').value};const {data:stu,error}=await sb.from('students').insert(payload).select().single();if(error)return alert(error.message);const {error:pe}=await sb.from('projects').insert({student_id:stu.id,title:m.querySelector('#pTitle').value.trim(),description:m.querySelector('#pDesc').value.trim(),semester:1});if(pe)return alert(pe.message);m.remove();await loadData();render();};}

  function toLocalInput(value){
    if(!value)return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:BRUNEI_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const g=t=>parts.find(x=>x.type===t)?.value||'';
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
  }
  function localInputToIso(value){
    if(!value)return null;
    const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if(!m)return null;
    const [,y,mo,d,h,mi]=m;
    return new Date(Date.UTC(+y,+mo-1,+d,+h-8,+mi,0,0)).toISOString();
  }

  function openTaskModal(taskId=null,duplicate=false){
    if(!state.students.length)return alert('Add students first.');
    const source=taskId?state.tasks.find(t=>t.id===taskId):null;
    const editing=!!source&&!duplicate;
    const selected=source?state.assignments.filter(a=>a.task_id===source.id).map(a=>a.student_id):[];
    const stages=['Problem Definition','Literature Review','Methodology','Design','Development','Experiment','Results','Report Writing','Presentation','Publication','Other'];
    const priority=source?.priority||'normal';
    const title=duplicate?`Copy of ${source?.title||''}`:(source?.title||'');
    const m=modal(`<h2>${editing?'Edit FYP Task':duplicate?'Duplicate FYP Task':'Create FYP Task'}</h2><p class="muted task-form-intro">Type the task exactly as you want the student to receive it. You can assign one task to one student, several students, or everyone.</p><form id="taskForm" class="form-grid">
      <div class="field full"><label>Task title</label><input id="tTitle" value="${esc(title)}" placeholder="e.g. Complete initial literature review matrix" required></div>
      <div class="field"><label>Research stage</label><select id="tStage">${stages.map(x=>`<option ${x===(source?.stage||'Problem Definition')?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Semester</label><select id="tSem"><option value="1" ${(source?.semester||1)===1?'selected':''}>Semester 1</option><option value="2" ${source?.semester===2?'selected':''}>Semester 2</option></select></div>
      <div class="field"><label>Priority</label><select id="tPriority"><option value="normal" ${priority==='normal'?'selected':''}>Normal</option><option value="important" ${priority==='important'?'selected':''}>Important</option><option value="milestone" ${priority==='milestone'?'selected':''}>Major milestone</option></select></div>
      <div class="field"><label>Open date/time</label><input id="tOpen" type="datetime-local" value="${esc(toLocalInput(source?.open_at))}"></div>
      <div class="field"><label>Submission deadline</label><input id="tDue" type="datetime-local" value="${esc(toLocalInput(source?.due_at))}" required></div>
      <div class="field full"><label>Instructions</label><textarea id="tInst" placeholder="Explain what the student should do, how far they should go, and any method/constraints to follow." required>${esc(source?.instructions||'')}</textarea></div>
      <div class="field full"><label>Expected output</label><textarea id="tOutput" placeholder="e.g. Completed literature matrix for 10 papers + 1-page synthesis + proposed research gap">${esc(source?.expected_output||'')}</textarea></div>
      <div class="field full"><label>Evidence required</label><textarea id="tEvidence" placeholder="e.g. PDF/DOI list, screenshots, CAD file/image, code link, raw data, graphs, video demo, report section">${esc(source?.evidence_requirements||'')}</textarea></div>
      <div class="field"><label class="switch-row"><input id="tLate" type="checkbox" ${source?.allow_late===false?'':'checked'}><span>Allow late submission</span></label><div class="help">If disabled, students cannot submit after the deadline.</div></div>
      <div class="field"><label class="switch-row"><input id="tRevision" type="checkbox" ${source?.allow_revision===false?'':'checked'}><span>Allow revision / resubmission</span></label><div class="help">You can still request changes through feedback when enabled.</div></div>
      <div class="field full"><div class="assign-header"><label>Assign to</label><div><button type="button" class="text-btn" id="selectAllStudents">Select all</button><button type="button" class="text-btn" id="clearStudents">Clear</button></div></div><div class="student-picker">${state.students.map(stu=>{const proj=projectForStudent(stu.id);return `<label class="student-choice"><input type="checkbox" name="assignee" value="${stu.id}" ${selected.includes(stu.id)?'checked':''}><span><b>${esc(stu.full_name)}</b><small>${esc(proj?.title||'Project not assigned')}</small></span></label>`}).join('')}</div></div>
      <div class="actions field full">${closeBtn()}<button class="btn">${editing?'Save Changes':'Publish Task'}</button></div>
    </form>`);
    m.querySelector('[data-close]').onclick=()=>m.remove();
    m.querySelector('#selectAllStudents').onclick=()=>m.querySelectorAll('input[name=assignee]').forEach(x=>x.checked=true);
    m.querySelector('#clearStudents').onclick=()=>m.querySelectorAll('input[name=assignee]').forEach(x=>x.checked=false);
    m.querySelector('#taskForm').onsubmit=async e=>{
      e.preventDefault();
      const ids=[...m.querySelectorAll('input[name=assignee]:checked')].map(x=>x.value);
      if(!ids.length)return alert('Select at least one student.');
      const payload={title:m.querySelector('#tTitle').value.trim(),stage:m.querySelector('#tStage').value,semester:+m.querySelector('#tSem').value,priority:m.querySelector('#tPriority').value,open_at:localInputToIso(m.querySelector('#tOpen').value),due_at:localInputToIso(m.querySelector('#tDue').value),instructions:m.querySelector('#tInst').value.trim(),expected_output:m.querySelector('#tOutput').value.trim(),evidence_requirements:m.querySelector('#tEvidence').value.trim(),allow_late:m.querySelector('#tLate').checked,allow_revision:m.querySelector('#tRevision').checked,created_by:state.user.id};
      let task;
      if(editing){
        const r=await sb.from('tasks').update(payload).eq('id',source.id).select().single();if(r.error)return alert(r.error.message);task=r.data;
        const del=await sb.from('task_assignments').delete().eq('task_id',source.id);if(del.error)return alert(del.error.message);
      }else{
        const r=await sb.from('tasks').insert(payload).select().single();if(r.error)return alert(r.error.message);task=r.data;
      }
      const ae=await sb.from('task_assignments').insert(ids.map(student_id=>({task_id:task.id,student_id})));if(ae.error)return alert(ae.error.message);
      m.remove();await loadData();render();
    };
  }

  function openTaskSubmitModal(taskId,studentId){const t=state.tasks.find(x=>x.id===taskId),old=latestSubmission(taskId,studentId);if(!old&&t.allow_late===false&&t.due_at&&new Date(t.due_at)<now())return alert('This task is closed because late submissions are not allowed.');if(old&&t.allow_revision===false)return alert('Revision/resubmission is disabled for this task. Contact your FYP administrator if changes are required.');const m=modal(`<h2>${esc(t.title)}</h2><div class="notice"><b>Due:</b> ${fmt(t.due_at)}<br><b>Expected output:</b> ${esc(t.expected_output||'See task instructions')}<br><b>Expected evidence:</b> ${esc(t.evidence_requirements||'Evidence supporting the completed work')}</div><p>${esc(t.instructions||'')}</p><form id="submitForm" class="form-grid"><div class="field full"><label>Work completed</label><textarea id="subSummary" required>${esc(old?.summary||'')}</textarea></div><div class="field full"><label>Results / findings</label><textarea id="subResults">${esc(old?.results||'')}</textarea></div><div class="field full"><label>What do these results mean?</label><textarea id="subMeaning">${esc(old?.interpretation||'')}</textarea></div><div class="field"><label>Problems encountered</label><textarea id="subProblems">${esc(old?.problems||'')}</textarea></div><div class="field"><label>Solution / next action</label><textarea id="subNext">${esc(old?.next_action||'')}</textarea></div><div class="field full"><label>Report section updated</label><input id="subReport" value="${esc(old?.report_section||'')}" placeholder="e.g. Chapter 2 Section 2.4"></div><div class="field full"><label>Evidence files</label><input id="subFiles" type="file" multiple><div class="help">Upload graphs, screenshots, PDFs, CAD images, code exports or other evidence.</div></div><div class="field full"><label>External evidence link (optional)</label><input id="subLink" type="url" value="${esc(old?.external_link||'')}" placeholder="https://github.com/... or Drive link"></div><div class="actions field full">${closeBtn()}<button class="btn">${old?'Submit Revision':'Submit Task'}</button></div></form>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelector('#submitForm').onsubmit=async e=>{e.preventDefault();const data={task_id:taskId,student_id:studentId,summary:m.querySelector('#subSummary').value.trim(),results:m.querySelector('#subResults').value.trim(),interpretation:m.querySelector('#subMeaning').value.trim(),problems:m.querySelector('#subProblems').value.trim(),next_action:m.querySelector('#subNext').value.trim(),report_section:m.querySelector('#subReport').value.trim(),external_link:m.querySelector('#subLink').value.trim()||null,status:old?'resubmitted':'submitted',submitted_at:new Date().toISOString(),revision_no:(old?.revision_no||0)+1};
      let sub;if(old){const r=await sb.from('submissions').update(data).eq('id',old.id).select().single();if(r.error)return alert(r.error.message);sub=r.data;}else{const r=await sb.from('submissions').insert(data).select().single();if(r.error)return alert(r.error.message);sub=r.data;}
      const files=[...m.querySelector('#subFiles').files];for(const f of files){const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${studentId}/${taskId}/${sub.id}/${Date.now()}_${safe}`;const up=await sb.storage.from(cfg.evidenceBucket||'fyp-evidence').upload(path,f,{upsert:false});if(up.error)return alert('File upload failed: '+up.error.message);await sb.from('submission_files').insert({submission_id:sub.id,student_id:studentId,storage_path:path,file_name:f.name,file_type:f.type,file_size:f.size});}
      m.remove();await loadData();render();};}

  async function openSubmissionModal(id){const s=state.submissions.find(x=>x.id===id),t=state.tasks.find(x=>x.id===s.task_id),stu=state.students.find(x=>x.id===s.student_id);const {data:files}=await sb.from('submission_files').select('*').eq('submission_id',id).order('uploaded_at');const feedback=state.feedback.filter(f=>f.submission_id===id);let fileHtml='';for(const f of files||[]){const {data}=await sb.storage.from(cfg.evidenceBucket||'fyp-evidence').createSignedUrl(f.storage_path,3600);fileHtml+=`<div class="file-row"><span>${esc(f.file_name)}</span>${data?.signedUrl?`<a href="${data.signedUrl}" target="_blank" rel="noopener">Open</a>`:''}</div>`;}
    const m=modal(`<h2>${esc(t?.title||'Submission')}</h2><div class="notice"><b>${esc(stu?.full_name||'')}</b> · Submitted ${fmt(s.submitted_at)} · Revision ${s.revision_no||1}</div><div class="grid cols-2" style="margin-top:14px"><div class="card"><b>Work completed</b><p>${esc(s.summary||'—')}</p></div><div class="card"><b>Results / findings</b><p>${esc(s.results||'—')}</p></div><div class="card"><b>Interpretation</b><p>${esc(s.interpretation||'—')}</p></div><div class="card"><b>Problems / next action</b><p>${esc(s.problems||'—')}<br>${esc(s.next_action||'')}</p></div></div><h3>Evidence</h3>${fileHtml||'<div class="muted">No uploaded files.</div>'}${s.external_link?`<p><a href="${esc(s.external_link)}" target="_blank" rel="noopener">External evidence link</a></p>`:''}<h3>Feedback history</h3>${feedback.map(f=>`<div class="log-entry"><strong>${esc(f.decision)}</strong><div>${esc(f.comment||'')}</div><span class="tiny muted">${fmt(f.created_at)}</span></div>`).join('')||'<div class="muted">No feedback yet.</div>'}${isAdmin()?`<form id="reviewForm" class="form-grid" style="margin-top:18px"><div class="field"><label>Decision</label><select id="decision"><option value="approved">Approve</option><option value="revision_required">Revision Required</option><option value="incomplete">Incomplete</option></select></div><div class="field"><label>Revision due (optional)</label><input id="revDue" type="datetime-local"></div><div class="field full"><label>Admin feedback</label><textarea id="comment" required></textarea></div><div class="actions field full">${closeBtn()}<button class="btn">Save Review</button></div></form>`:`<div class="actions">${closeBtn()}</div>`}`);
    m.querySelector('[data-close]').onclick=()=>m.remove();const rf=m.querySelector('#reviewForm');if(rf)rf.onsubmit=async e=>{e.preventDefault();const decision=m.querySelector('#decision').value,comment=m.querySelector('#comment').value.trim(),revision_due_at=localInputToIso(m.querySelector('#revDue').value);const r=await sb.from('feedback').insert({submission_id:id,supervisor_id:state.user.id,decision,comment,revision_due_at});if(r.error)return alert(r.error.message);const u=await sb.from('submissions').update({status:decision}).eq('id',id);if(u.error)return alert(u.error.message);m.remove();await loadData();render();};
  }

  function openTaskReviewModal(taskId){const t=state.tasks.find(x=>x.id===taskId),ass=state.assignments.filter(a=>a.task_id===taskId);const rows=ass.map(a=>{const stu=state.students.find(s=>s.id===a.student_id),sub=latestSubmission(taskId,a.student_id),[lab,cl]=assignmentStatus(t,a.student_id);return `<tr><td>${esc(stu?.full_name||'')}</td><td><span class="pill ${cl}">${lab}</span></td><td>${sub?fmt(sub.submitted_at):'—'}</td><td>${sub?`<button class="btn secondary small openSubInside" data-id="${sub.id}">Open</button>`:'—'}</td></tr>`}).join('');const m=modal(`<h2>${esc(t.title)}</h2><p>${esc(t.instructions||'')}</p><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="actions">${closeBtn()}</div>`);m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelectorAll('.openSubInside').forEach(b=>b.onclick=()=>{m.remove();openSubmissionModal(b.dataset.id);});}

  function runExport(){const studentId=q('#exportStudent').value,type=q('#exportType').value,stu=state.students.find(s=>s.id===studentId),p=projectForStudent(studentId),ass=state.assignments.filter(a=>a.student_id===studentId),rows=ass.map(a=>{const t=state.tasks.find(x=>x.id===a.task_id),s=latestSubmission(a.task_id,studentId);return {task:t?.title||'',stage:t?.stage||'',due:t?.due_at||'',submitted:s?.submitted_at||'',status:s?.status||'pending',summary:s?.summary||'',results:s?.results||'',interpretation:s?.interpretation||'',report:s?.report_section||''};});
    if(type==='csv'){const headers=Object.keys(rows[0]||{task:'',stage:'',due:'',submitted:'',status:'',summary:'',results:'',interpretation:'',report:''});const csv=[headers.join(','),...rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`FYP_${(stu?.full_name||'student').replace(/\s+/g,'_')}_record.csv`;a.click();URL.revokeObjectURL(url);return;}
    const meetings=state.meetingBookings.filter(b=>b.student_id===studentId).map(b=>({booking:b,slot:state.meetingSlots.find(sl=>sl.id===b.slot_id),record:meetingRecordForBooking(b.id),followups:followupsForBooking(b.id)})).filter(x=>x.slot);
    q('#exportPreview').innerHTML=`<div class="card" id="printRecord"><div class="print-title"><h1>FYP Supervision Record</h1></div><h2>${esc(stu?.full_name||'')}</h2><p><b>Project:</b> ${esc(p?.title||'')}</p><p><b>Academic year:</b> ${esc(state.cohorts.find(c=>c.id===stu?.academic_year_id)?.label||'')}</p><hr><h3>Supervision meetings & agreed actions</h3>${meetings.map(x=>`<div class="log-entry"><strong>${fmt(x.slot.start_at)}</strong><div class="tiny muted">${esc(x.slot.location||'')} ${x.slot.note?`· ${esc(x.slot.note)}`:''}</div>${x.record?.summary?`<p><b>Summary:</b> ${esc(x.record.summary)}</p>`:''}${x.record?.comments?`<p><b>Supervisor comments:</b> ${esc(x.record.comments)}</p>`:''}${x.record?.decisions?`<p><b>Decisions:</b> ${esc(x.record.decisions)}</p>`:''}${x.record?.progress_note?`<p><b>Progress / concerns:</b> ${esc(x.record.progress_note)}</p>`:''}${x.record?.next_meeting_focus?`<p><b>Next meeting focus:</b> ${esc(x.record.next_meeting_focus)}</p>`:''}${x.followups.length?`<p><b>Follow-up tasks:</b></p><ul>${x.followups.map(f=>`<li>${esc(f.title)}${f.due_at?` — due ${fmt(f.due_at)}`:''} [${esc(f.status)}]</li>`).join('')}</ul>`:''}</div>`).join('')||'<p>No meeting bookings recorded.</p>'}<hr><h3>Task and supervision history</h3>${rows.map(r=>`<div class="log-entry"><strong>${esc(r.task)}</strong><div class="tiny muted">${esc(r.stage)} · Due ${fmt(r.due)} · Submitted ${fmt(r.submitted)} · ${esc(r.status)}</div>${r.summary?`<p><b>Work:</b> ${esc(r.summary)}</p>`:''}${r.results?`<p><b>Results:</b> ${esc(r.results)}</p>`:''}${r.interpretation?`<p><b>Interpretation:</b> ${esc(r.interpretation)}</p>`:''}${r.report?`<p><b>Report section:</b> ${esc(r.report)}</p>`:''}</div>`).join('')||'<p>No task history.</p>'}</div><div class="actions no-print"><button class="btn" id="printNow">Print / Save PDF</button></div>`;q('#printNow').onclick=()=>window.print();
  }

  init();
})();
