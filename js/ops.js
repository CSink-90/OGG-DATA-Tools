/* ------------------------------ Technicians ------------------------------ */
function ensureDefaultTechnicians(){
  if(!STATE.technicians || typeof STATE.technicians !== 'object' || Array.isArray(STATE.technicians)){
    STATE.technicians = {};
  }
  if(Object.keys(STATE.technicians).length === 0){
    for(let i=0;i<6;i++){ STATE.technicians[genId()] = { name:'', status:'active' }; }
  }
}

function renderTechPanel(){
  const wrap = document.getElementById('techList');
  if(document.activeElement && wrap.contains(document.activeElement)) return; // mid-edit — skip this refresh
  const entries = Object.entries(STATE.technicians);
  wrap.innerHTML = entries.map(([id, t])=>`
    <div class="tech-row" data-id="${id}">
      <input type="text" class="tech-name" placeholder="Technician name" value="${(t.name||'').replace(/"/g,'&quot;')}">
      <button type="button" class="tstatus ${t.status}" data-id="${id}">${t.status === 'active' ? 'Active' : 'Idle'}</button>
      <button type="button" class="tdel" data-id="${id}" title="Remove">&times;</button>
    </div>`).join('');

  wrap.querySelectorAll('.tech-name').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const id = inp.closest('.tech-row').getAttribute('data-id');
      STATE.technicians[id].name = inp.value;
      scheduleTechSave(id);
    });
  });
  wrap.querySelectorAll('.tstatus').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-id');
      STATE.technicians[id].status = STATE.technicians[id].status === 'active' ? 'idle' : 'active';
      renderTechPanel();
      commitFieldChange('technicians', id, STATE.technicians[id]);
      renderHealthCard();
    });
  });
  wrap.querySelectorAll('.tdel').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-id');
      delete STATE.technicians[id];
      renderTechPanel();
      deleteFieldChange('technicians', id);
    });
  });
}
const techSaveTimers = {};
function scheduleTechSave(id){
  clearTimeout(techSaveTimers[id]);
  techSaveTimers[id] = setTimeout(()=> commitFieldChange('technicians', id, STATE.technicians[id]), 500);
}

function wireTechPanel(){
  document.getElementById('addTechBtn').addEventListener('click', ()=>{
    const id = genId();
    STATE.technicians[id] = { name:'', status:'active' };
    renderTechPanel();
    commitFieldChange('technicians', id, STATE.technicians[id]);
  });
}

/* ------------------------------ Health card ------------------------------ */
function renderHealthCard(){
  const counts = { active:0, inactive:0, maintenance:0 };
  PDU_LIST.forEach(p=>{
    const e = STATE.pdu[p.id];
    const s = (e && e.status) || DEFAULT_STATUS;
    counts[s] = (counts[s]||0) + 1;
  });
  const total = PDU_LIST.length;
  document.getElementById('healthCard').innerHTML = `
    <div class="hc-title">Network Health</div>
    <div class="hc-row"><span>Total PDUs</span><span class="n">${total}</span></div>
    <div class="hc-row active"><span>Active</span><span class="n">${counts.active}</span></div>
    <div class="hc-row inactive"><span>Inactive / Broken</span><span class="n">${counts.inactive}</span></div>
    <div class="hc-row maint"><span>Maintenance</span><span class="n">${counts.maintenance}</span></div>
    <div class="hc-bar">
      <span style="width:${counts.active/total*100}%;background:var(--active)"></span>
      <span style="width:${counts.inactive/total*100}%;background:var(--inactive)"></span>
      <span style="width:${counts.maintenance/total*100}%;background:var(--maint)"></span>
    </div>`;
}

/* ------------------------------ Active issues ------------------------------ */
function activePduList(){
  return PDU_LIST
    .map(p=> ({ p, e: STATE.pdu[p.id] }))
    .filter(x=> x.e && x.e.note && x.e.note.trim());
}

function renderIssuesPanel(){
  const items = activePduList();
  const wrap = document.getElementById('issuesList');
  if(!items.length){ wrap.innerHTML = '<div class="ii-empty">No open notes right now.</div>'; return; }
  wrap.innerHTML = items.map(({p,e})=>`
    <div class="issue-item" data-id="${p.id}">
      <span class="ii-id">${p.id}</span><span class="ii-status ${e.status}">${e.status}</span>
      <div class="ii-tech">${e.workingTechs.length ? e.workingTechs.join(', ') : 'Unassigned'}</div>
      <div class="ii-note">${e.note.replace(/</g,'&lt;').slice(0,120)}</div>
    </div>`).join('');
  wrap.querySelectorAll('.issue-item').forEach(el=>{
    el.addEventListener('click', ()=> jumpToPdu(el.getAttribute('data-id')));
  });
}

/* ------------------------------ Activity feed ------------------------------ */
function renderActivityFeed(){
  const wrap = document.getElementById('activityList');
  if(!STATE.activity || !STATE.activity.length){ wrap.innerHTML = '<div class="at-empty">No activity yet.</div>'; return; }
  wrap.innerHTML = STATE.activity.slice(0, 40).map(a=>`
    <div class="activity-item">
      <span class="at-time">${new Date(a.ts).toLocaleString()}</span>
      <strong>${a.who}</strong> — ${a.action}${a.target ? ' — ' + a.target : ''}${a.detail ? ': ' + a.detail.replace(/</g,'&lt;') : ''}
    </div>`).join('');
}

/* ------------------------------ Active Notes modal ------------------------------ */
function openActiveModal(){
  const items = activePduList();
  const body = document.getElementById('amBody');
  if(!items.length){
    body.innerHTML = '<div class="ii-empty">No PDUs currently have notes.</div>';
  }else{
    body.innerHTML = items.map(({p,e})=>`
      <div class="issue-item" data-id="${p.id}">
        <span class="ii-id">${p.id}</span><span class="ii-status ${e.status}">${e.status}</span>
        <div class="ii-tech">${e.workingTechs.length ? e.workingTechs.join(', ') : 'Unassigned'}</div>
        <div class="ii-note">${e.note.replace(/</g,'&lt;')}</div>
      </div>`).join('');
    body.querySelectorAll('.issue-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        document.getElementById('activeModal').style.display = 'none';
        jumpToPdu(el.getAttribute('data-id'));
      });
    });
  }
  document.getElementById('activeModal').style.display = 'flex';
}

function wireActiveModal(){
  document.getElementById('viewActiveBtn').addEventListener('click', openActiveModal);
  document.getElementById('amClose').addEventListener('click', ()=> document.getElementById('activeModal').style.display = 'none');
  document.getElementById('activeModal').addEventListener('click', (e)=>{
    if(e.target.id === 'activeModal') document.getElementById('activeModal').style.display = 'none';
  });
}

/* ------------------------------ General IT Tasks board (not tied to a PDU) ------------------------------ */
const TASK_STATUS_LABEL = { open: 'Open', inprogress: 'In Progress', done: 'Done' };

function taskRowHTML(t, idx){
  const techs = Object.values(STATE.technicians || {}).filter(x => x.name && x.name.trim());
  const techOptions = ['<option value="">Unassigned</option>']
    .concat(techs.map(x => `<option value="${x.name.replace(/"/g,'&quot;')}" ${t.assignedTech===x.name?'selected':''}>${x.name}</option>`))
    .join('');
  return `<tr data-idx="${idx}">
    <td><input type="text" class="ts-title-input" value="${(t.title||'').replace(/"/g,'&quot;')}" placeholder="e.g. Replace UPS battery in Rack 3"></td>
    <td><select class="ts-assigned">${techOptions}</select></td>
    <td><select class="ts-status status-${t.status||'open'}">
      <option value="open" ${t.status==='open'?'selected':''}>Open</option>
      <option value="inprogress" ${t.status==='inprogress'?'selected':''}>In Progress</option>
      <option value="done" ${t.status==='done'?'selected':''}>Done</option>
    </select></td>
    <td><input type="date" class="ts-due" value="${t.dueDate||''}"></td>
    <td><input type="text" class="ts-notes" value="${(t.notes||'').replace(/"/g,'&quot;')}" placeholder="details..."></td>
    <td><button type="button" class="ts-rowdel" data-idx="${idx}" title="Remove task">&times;</button></td>
  </tr>`;
}

function renderTasksBoard(){
  const tbody = document.getElementById('tasksTbody');
  if(document.activeElement && tbody.contains(document.activeElement)) return; // mid-edit — skip this refresh
  if(!STATE.tasks || !STATE.tasks.length){
    tbody.innerHTML = `<tr><td colspan="6" class="ts-empty">No tasks yet — click "+ Add Task" to log the first one.</td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.tasks.map(taskRowHTML).join('');
}

let taskSaveTimer = null;
function scheduleTaskSave(){
  clearTimeout(taskSaveTimer);
  taskSaveTimer = setTimeout(()=> commitChange('tasks'), 400);
}

function wireTasksBoard(){
  const tbody = document.getElementById('tasksTbody');
  tbody.addEventListener('input', (e)=>{
    const tr = e.target.closest('tr'); if(!tr || !tr.hasAttribute('data-idx')) return;
    const idx = Number(tr.getAttribute('data-idx'));
    STATE.tasks[idx] = {
      title: tr.querySelector('.ts-title-input').value,
      assignedTech: tr.querySelector('.ts-assigned').value,
      status: tr.querySelector('.ts-status').value,
      dueDate: tr.querySelector('.ts-due').value,
      notes: tr.querySelector('.ts-notes').value
    };
    scheduleTaskSave();
  });
  tbody.addEventListener('change', (e)=>{
    if(!e.target.classList.contains('ts-status') && !e.target.classList.contains('ts-assigned')) return;
    const tr = e.target.closest('tr'); if(!tr || !tr.hasAttribute('data-idx')) return;
    const idx = Number(tr.getAttribute('data-idx'));
    STATE.tasks[idx] = {
      title: tr.querySelector('.ts-title-input').value,
      assignedTech: tr.querySelector('.ts-assigned').value,
      status: tr.querySelector('.ts-status').value,
      dueDate: tr.querySelector('.ts-due').value,
      notes: tr.querySelector('.ts-notes').value
    };
    if(e.target.classList.contains('ts-status')){
      e.target.className = 'ts-status status-' + e.target.value;
    }
    commitChange('tasks');
  });
  tbody.addEventListener('click', (e)=>{
    if(!e.target.classList.contains('ts-rowdel')) return;
    const idx = Number(e.target.getAttribute('data-idx'));
    STATE.tasks.splice(idx, 1);
    renderTasksBoard();
    commitChange('tasks');
  });
  document.getElementById('tasksAddRow').addEventListener('click', ()=>{
    STATE.tasks.push({ title:'', assignedTech:'', status:'open', dueDate:'', notes:'' });
    renderTasksBoard();
    commitChange('tasks');
  });
}
