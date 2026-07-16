/* ------------------------------ Equipment inventory ------------------------------ */
const INV_MIN_ROWS = 5;
function ensureMinInventory(){
  if(!STATE.inventory) STATE.inventory = [];
  while(STATE.inventory.length < INV_MIN_ROWS) STATE.inventory.push({ part:'', qty:'', notes:'' });
}
function invRowHTML(item, idx){
  return `<tr data-idx="${idx}">
    <td><input type="text" class="inv-part" value="${(item.part||'').replace(/"/g,'&quot;')}" placeholder="e.g. PDU Circuit Breaker"></td>
    <td><input type="number" class="inv-qty" value="${item.qty!==undefined && item.qty!==null ? item.qty : ''}" min="0" placeholder="0"></td>
    <td><input type="text" class="inv-notes" value="${(item.notes||'').replace(/"/g,'&quot;')}" placeholder="model / stock location / spare"></td>
    <td><button type="button" class="inv-rowdel" data-idx="${idx}" title="Remove row">&times;</button></td>
  </tr>`;
}
function renderInventory(){
  const tbody = document.getElementById('invTbody');
  if(document.activeElement && tbody.contains(document.activeElement)) return; // mid-edit — skip this refresh
  tbody.innerHTML = STATE.inventory.map(invRowHTML).join('');
}
let invSaveTimer = null;
function scheduleInvSave(){
  clearTimeout(invSaveTimer);
  invSaveTimer = setTimeout(()=>{
    commitChange('inventory');
    const s = document.getElementById('invSaved');
    s.classList.add('show'); setTimeout(()=> s.classList.remove('show'), 1200);
  }, 400);
}
function wireInventory(){
  const tbody = document.getElementById('invTbody');
  tbody.addEventListener('input', (e)=>{
    const tr = e.target.closest('tr'); if(!tr) return;
    const idx = Number(tr.getAttribute('data-idx'));
    STATE.inventory[idx] = {
      part: tr.querySelector('.inv-part').value,
      qty: tr.querySelector('.inv-qty').value,
      notes: tr.querySelector('.inv-notes').value
    };
    scheduleInvSave();
  });
  tbody.addEventListener('click', (e)=>{
    if(!e.target.classList.contains('inv-rowdel')) return;
    const idx = Number(e.target.getAttribute('data-idx'));
    if(STATE.inventory.length <= INV_MIN_ROWS){
      STATE.inventory[idx] = { part:'', qty:'', notes:'' };
    }else{
      STATE.inventory.splice(idx, 1);
    }
    renderInventory();
    commitChange('inventory');
  });
  document.getElementById('invAddRow').addEventListener('click', ()=>{
    STATE.inventory.push({ part:'', qty:'', notes:'' });
    renderInventory();
    commitChange('inventory');
  });
  const invPanel = document.getElementById('invPanel');
  const invToggle = document.getElementById('invToggle');
  document.getElementById('invHead').addEventListener('click', ()=>{
    const collapsed = invPanel.classList.toggle('collapsed');
    invToggle.innerHTML = collapsed ? '&#9650;' : '&#9660;';
    try{ localStorage.setItem('ogg_inv_collapsed_v1', collapsed ? '1':'0'); }catch(e){}
  });
  try{ if(localStorage.getItem('ogg_inv_collapsed_v1') === '1'){ invPanel.classList.add('collapsed'); invToggle.innerHTML = '&#9650;'; } }catch(e){}
}

/* ------------------------------ Static System Notes banner ------------------------------ */
function wireSystemNotesBanner(){
  const ta = document.getElementById('systemNotesText');
  ta.value = STATE.systemNotes || '';
  let t = null;
  ta.addEventListener('input', ()=>{
    STATE.systemNotes = ta.value;
    clearTimeout(t);
    t = setTimeout(()=> commitChange('systemNotes'), 500);
  });
}

/* ------------------------------ Ticker strip ------------------------------ */
const TICKER_DEFAULT = 'OGG VIDEO WALL — SCREEN HOUSING — 55 PDU REFERENCE GRID — CLICK THE ICON TO EDIT —';
function tickerRender(){
  const s1 = document.getElementById('tickerSpan1'), s2 = document.getElementById('tickerSpan2');
  if(!s1 || !s2) return; // ticker is mid-edit (input swapped in) — skip until commit/cancel restores the spans
  const text = STATE.ticker || TICKER_DEFAULT;
  s1.textContent = text;
  s2.textContent = text;
}
function wireTicker(){
  const track = document.getElementById('tickerTrack');
  function startEdit(){
    const input = document.createElement('input');
    input.type = 'text';
    input.value = STATE.ticker || TICKER_DEFAULT;
    track.innerHTML = '';
    track.appendChild(input);
    input.focus(); input.select();
    function commit(){
      STATE.ticker = input.value || TICKER_DEFAULT;
      commitChange('ticker');
      track.innerHTML = '<div class="ticker-scroll" id="tickerScroll"><span id="tickerSpan1"></span><span id="tickerSpan2"></span></div>';
      tickerRender();
    }
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') commit();
      if(e.key === 'Escape'){ track.innerHTML = '<div class="ticker-scroll" id="tickerScroll"><span id="tickerSpan1"></span><span id="tickerSpan2"></span></div>'; tickerRender(); }
    });
    input.addEventListener('blur', commit);
  }
  document.getElementById('tickerEditBtn').addEventListener('click', startEdit);
  track.addEventListener('dblclick', startEdit);
  tickerRender();
}

/* ------------------------------ Site & Vendor Info (LOCAL ONLY — never synced) ------------------------------ */
function wireSiteVendorPanel(){
  const KEY = 'ogg_sitevendor_v1';
  const POS_KEY = 'ogg_sitevendor_pos_v1';
  const panel = document.getElementById('notesPanel');
  const fields = {
    location: document.getElementById('npLocation'),
    server: document.getElementById('npServer'),
    user: document.getElementById('npUser'),
    pass: document.getElementById('npPass'),
    vendor: document.getElementById('npVendor')
  };
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ const data = JSON.parse(raw); Object.keys(fields).forEach(k=>{ if(data[k]!==undefined) fields[k].value = data[k]; }); }
  }catch(e){}
  let t = null;
  Object.values(fields).forEach(f=> f.addEventListener('input', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      const data = {}; Object.keys(fields).forEach(k=> data[k] = fields[k].value);
      try{
        localStorage.setItem(KEY, JSON.stringify(data));
        const s = document.getElementById('npSaved');
        s.classList.add('show'); setTimeout(()=> s.classList.remove('show'), 1200);
      }catch(e){}
    }, 400);
  }));
  document.getElementById('npPassToggle').addEventListener('click', ()=>{
    const isPw = fields.pass.type === 'password';
    fields.pass.type = isPw ? 'text' : 'password';
    document.getElementById('npPassToggle').textContent = isPw ? 'Hide' : 'Show';
  });
  function setVisible(v){
    panel.classList.toggle('hidden', !v);
    document.getElementById('notesToggleBtn').classList.toggle('active', v);
  }
  document.getElementById('notesToggleBtn').addEventListener('click', ()=> setVisible(panel.classList.contains('hidden')));
  document.getElementById('notesClose').addEventListener('click', ()=> setVisible(false));
  try{
    const pos = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if(pos){ panel.style.left = pos.left+'px'; panel.style.top = pos.top+'px'; }
  }catch(e){}
  let dragging = false, offX=0, offY=0;
  const head = document.getElementById('notesHead');
  head.addEventListener('mousedown', (e)=>{
    dragging = true;
    const r = panel.getBoundingClientRect();
    offX = e.clientX - r.left; offY = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const left = Math.max(4, Math.min(window.innerWidth-40, e.clientX-offX));
    const top = Math.max(4, Math.min(window.innerHeight-40, e.clientY-offY));
    panel.style.left = left+'px'; panel.style.top = top+'px';
  });
  document.addEventListener('mouseup', ()=>{
    if(!dragging) return;
    dragging = false;
    const r = panel.getBoundingClientRect();
    try{ localStorage.setItem(POS_KEY, JSON.stringify({left:r.left, top:r.top})); }catch(e){}
  });
}

/* ------------------------------ Export / Import ------------------------------ */
function downloadBlob(filename, content, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 250);
}

function wireExportImport(){
  document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
    const data = PDU_LIST.map(p=>{
      const e = STATE.pdu[p.id] || {};
      return { id:p.id, grid:p.grid, status:e.status||DEFAULT_STATUS, workingTechs:e.workingTechs||[], note:e.note||'', updatedBy:e.updatedBy||'', updatedAt:e.updatedAt||'' };
    });
    downloadBlob('OGG_PDU_Notes.json', JSON.stringify(data, null, 2), 'application/json');
  });
  document.getElementById('exportCsvBtn').addEventListener('click', ()=>{
    let rows = [['PDU','Grid','Status','Technicians','Notes','UpdatedBy','UpdatedAt']];
    PDU_LIST.forEach(p=>{
      const e = STATE.pdu[p.id] || {};
      rows.push([p.id, p.grid, e.status||DEFAULT_STATUS, (e.workingTechs||[]).join('; '), (e.note||'').replace(/"/g,'""'), e.updatedBy||'', e.updatedAt||'']);
    });
    const csv = rows.map(r=> r.map(v=> `"${v}"`).join(',')).join('\n');
    downloadBlob('OGG_PDU_Notes.csv', csv, 'text/csv');
  });
  document.getElementById('importBtn').addEventListener('click', ()=> document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      try{
        const data = JSON.parse(ev.target.result);
        data.forEach(row=>{
          if(!row.id) return;
          const entry = ensurePduEntry(row.id);
          if(row.status && COLORS[row.status]) entry.status = row.status;
          if(row.note !== undefined) entry.note = row.note;
          if(Array.isArray(row.workingTechs)) entry.workingTechs = row.workingTechs;
        });
        logActivity(CONN.account ? CONN.account.name : 'Import', 'Imported notes file', '', file.name);
        await commitChange('pdu');
        refreshDotsAndFlags(); renderIssuesPanel(); renderHealthCard(); renderActivityFeed();
      }catch(err){ alert('Could not read that file — please select a valid exported .json file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}
